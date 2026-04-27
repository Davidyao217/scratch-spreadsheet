import * as engine from '../src/engine.js';
import { initUI } from '../src/ui.js';
import { mid } from '../src/parser.js';

// 1. Initialize the UI and pass it the engine to bind to
initUI(engine);

// 2. Hydrate the engine with initial data
engine.initEngine({});

// 3. Prevent accidental data loss on reload/quit
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

// Google Drive Integration
let tokenClient;
let currentAccessToken = null;
let currentFileId = null;
let isUnsaved = false;

const svBtn = document.getElementById('sv');
const titleInput = document.getElementById('file-title');

function markUnsaved() {
    isUnsaved = true;
    svBtn.classList.add('unsaved');
}

function markSaved() {
    isUnsaved = false;
    svBtn.classList.remove('unsaved');
    svBtn.textContent = 'Sync to Drive';
}

engine.subscribe(() => markUnsaved());
titleInput.addEventListener('input', () => markUnsaved());

window.onload = () => {
    const storedToken = localStorage.getItem('drive_access_token');
    const storedExpiry = localStorage.getItem('drive_token_expiry');
    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        currentAccessToken = storedToken;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: '508217834882-hvbos0eqf369vebbtif9mghn56neolsr.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                currentAccessToken = tokenResponse.access_token;
                localStorage.setItem('drive_access_token', currentAccessToken);
                const expiresIn = tokenResponse.expires_in || 3599;
                localStorage.setItem('drive_token_expiry', Date.now() + (expiresIn * 1000));
                executeDriveUpload(currentAccessToken);
            }
        },
    });
};

document.getElementById('sv').addEventListener('click', () => {
    if (currentAccessToken && localStorage.getItem('drive_token_expiry') && Date.now() < parseInt(localStorage.getItem('drive_token_expiry'))) {
        executeDriveUpload(currentAccessToken);
    } else {
        tokenClient.requestAccessToken();
    }
});

function generateCSV() {
    const { maxCol, maxRow } = engine.getUsedBounds();
    const data = engine.getData();
    let csv = '';
    for (let r = 1; r <= maxRow; r++) {
        const row = [];
        for (let c = 0; c <= maxCol; c++) {
            const v = data[mid(c, r)] ?? '';
            row.push('"' + String(v).replace(/"/g, '""') + '"');
        }
        csv += row.join(',') + '\n';
    }
    return csv;
}

document.getElementById('ex').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([generateCSV()], { type: 'text/csv' }));
    a.download = `${titleInput.value.trim() || 'untitled'}.csv`;
    a.click();
});

function executeDriveUpload(accessToken) {
    const title = titleInput.value.trim() || 'untitled';
    const csvContent = generateCSV();
    const fileBlob = new Blob([csvContent], { type: 'text/csv' });

    const metadata = {
        name: `${title}.csv`,
        mimeType: 'text/csv'
    };
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });

    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', fileBlob);

    const method = currentFileId ? 'PATCH' : 'POST';
    const url = currentFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        body: form
    })
        .then(res => {
            if (res.status === 401) {
                currentAccessToken = null;
                localStorage.removeItem('drive_access_token');
                localStorage.removeItem('drive_token_expiry');
                tokenClient.requestAccessToken();
                throw new Error('Token expired, prompting re-auth.');
            }
            return res.json();
        })
        .then(data => {
            if (data && data.id) {
                currentFileId = data.id;
                markSaved();
                console.log(`Successfully saved to Drive. File ID: ${data.id} (Method: ${method})`);
            }
        })
        .catch(console.error);
}