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

function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false, i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
            else if (ch === '"') { inQuotes = false; i++; }
            else { field += ch; i++; }
        } else {
            if (ch === '"') { inQuotes = true; i++; }
            else if (ch === ',') { row.push(field); field = ''; i++; }
            else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 2; }
            else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
            else { field += ch; i++; }
        }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
}

document.getElementById('im').addEventListener('click', () => {
    document.getElementById('im-file').click();
});

const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('im-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(text => {
        const rows = parseCSV(text);
        const totalRows = rows.length;
        const totalCols = Math.max(0, ...rows.map(r => r.length));
        engine.pushHistory();
        engine.clearAllCells();
        rows.forEach((row, ri) => {
            if (ri >= 50) return;
            row.forEach((val, ci) => {
                if (ci >= 26) return;
                if (val !== '') engine.setCell(mid(ci, ri + 1), val);
            });
        });
        titleInput.value = file.name.replace(/\.csv$/i, '');
        currentFileId = null;
        markUnsaved();
        if (totalRows > 50 || totalCols > 26) {
            const cutRow = Math.min(totalRows, 50), cutCol = Math.min(totalCols, 26);
            showToast(`CSV cut off at row ${cutRow}, col ${cutCol} (was ${totalRows}×${totalCols})`);
        }
    });
    e.target.value = '';
});

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
        mimeType: 'application/vnd.google-apps.spreadsheet'
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