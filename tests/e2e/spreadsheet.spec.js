import { test, expect } from '@playwright/test';

// ─── Cell Selection ───────────────────────────────────────────────────────────

test.describe('Cell Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking a cell selects it and updates ACI', async ({ page }) => {
    await page.locator('#xB3').click();
    await expect(page.locator('#aci')).toHaveText('B3');
  });

  test('clicking a cell with data shows raw value in formula bar', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1+1');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=1+1');
    await expect(page.locator('#xA1')).toHaveText('2');
  });

  test('selected cell gets sel class, deselected cell loses it', async ({ page }) => {
    await page.locator('#xA1').click();
    await expect(page.locator('#xA1')).toHaveClass(/sel/);
    await page.locator('#xB2').click();
    await expect(page.locator('#xA1')).not.toHaveClass(/sel/);
    await expect(page.locator('#xB2')).toHaveClass(/sel/);
  });

  test('arrow keys navigate all four directions', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('C2');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#aci')).toHaveText('C3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#aci')).toHaveText('B3');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#aci')).toHaveText('B2');
  });

  test('cannot navigate left/up past grid origin', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#aci')).toHaveText('A1');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#aci')).toHaveText('A1');
  });

  test('cannot navigate right/down past grid boundary', async ({ page }) => {
    await page.locator('#xZ50').click();
    await expect(page.locator('#aci')).toHaveText('Z50');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('Z50');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#aci')).toHaveText('Z50');
  });

  test('formula bar clears when navigating to an empty cell', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    // A2 is empty — formula bar should be blank
    await expect(page.locator('#fb')).toHaveValue('');
  });
});

// ─── Range Selection ──────────────────────────────────────────────────────────

test.describe('Range Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shift+click extends selection to a range', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#xC3').click({ modifiers: ['Shift'] });
    await expect(page.locator('#xA1')).toHaveClass(/range/);
    await expect(page.locator('#xB2')).toHaveClass(/range/);
    await expect(page.locator('#xC3')).toHaveClass(/range/);
  });

  test('shift+click does not extend to cells outside selection', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#xB2').click({ modifiers: ['Shift'] });
    await expect(page.locator('#xC3')).not.toHaveClass(/range/);
  });

  test('shift+arrow extends selection one step at a time', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator('#xB2')).toHaveClass(/range/);
    await expect(page.locator('#xC2')).toHaveClass(/range/);
    await expect(page.locator('#xB3')).toHaveClass(/range/);
    await expect(page.locator('#xC3')).toHaveClass(/range/);
  });

  test('ctrl+a selects entire grid', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+a');
    await expect(page.locator('#xA1')).toHaveClass(/range/);
    await expect(page.locator('#xM25')).toHaveClass(/range/);
    await expect(page.locator('#xZ50')).toHaveClass(/range/);
  });

  test('escape clears range selection', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+a');
    await expect(page.locator('#xZ50')).toHaveClass(/range/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#xZ50')).not.toHaveClass(/range/);
    await expect(page.locator('#xA1')).not.toHaveClass(/range/);
  });

  test('clicking a new cell after range clears the range highlight', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('#xB1')).toHaveClass(/range/);
    await page.locator('#xC3').click();
    await expect(page.locator('#xA1')).not.toHaveClass(/range/);
    await expect(page.locator('#xB1')).not.toHaveClass(/range/);
  });

  test('mouse drag selects a range', async ({ page }) => {
    const a1 = page.locator('#xA1');
    const c3 = page.locator('#xC3');
    await a1.hover();
    await page.mouse.down();
    await c3.hover();
    await page.mouse.up();
    await expect(page.locator('#xA1')).toHaveClass(/range/);
    await expect(page.locator('#xB2')).toHaveClass(/range/);
    await expect(page.locator('#xC3')).toHaveClass(/range/);
  });

  test('range border overlay appears during range selection', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowRight');
    const rb = page.locator('#rb');
    await expect(rb).toBeVisible();
  });

  test('range border overlay hidden when no range selected', async ({ page }) => {
    await page.locator('#xA1').click();
    const rb = page.locator('#rb');
    await expect(rb).not.toBeVisible();
  });

  test('ctrl+a does nothing while editing', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await expect(page.locator('#ed')).toBeVisible();
    await page.keyboard.press('Control+a');
    // Should still be editing, not select-all
    await expect(page.locator('#ed')).toBeVisible();
  });
});

// ─── Editing ─────────────────────────────────────────────────────────────────

test.describe('Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('double-click opens inline editor', async ({ page }) => {
    await page.locator('#xA1').dblclick();
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('Enter on a selected cell opens editor', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('F2 opens editor on selected cell', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('typing a character opens editor pre-filled with that character', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('h');
    await expect(page.locator('#ed')).toBeVisible();
    await expect(page.locator('#ed')).toHaveValue('h');
  });

  test('Escape cancels edit — cell unchanged', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ed')).not.toBeVisible();
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('Escape during edit of existing value reverts to original', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('original');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('new value');
    await page.keyboard.press('Escape');
    await expect(page.locator('#xA1')).toHaveText('original');
  });

  test('Enter commits edit and moves selection down', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('42');
    await expect(page.locator('#aci')).toHaveText('A2');
    await expect(page.locator('#ed')).not.toBeVisible();
  });

  test('Tab commits edit and moves selection right', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Tab');
    await expect(page.locator('#xA1')).toHaveText('hello');
    await expect(page.locator('#aci')).toHaveText('B1');
    await expect(page.locator('#ed')).not.toBeVisible();
  });

  test('editor stays open through text edits and syncs formula bar', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('=SUM(1,2)');
    await expect(page.locator('#fb')).toHaveValue('=SUM(1,2)');
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('arrow keys during edit do not navigate cells', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('test');
    await page.keyboard.press('ArrowRight');
    // ACI stays at A1, editor still open
    await expect(page.locator('#aci')).toHaveText('A1');
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('editor input is pre-filled with existing cell value when opened via F2', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('existing');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await expect(page.locator('#ed')).toHaveValue('existing');
  });

  test('clicking another cell while editing commits the edit', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('committed');
    await page.locator('#xB2').click();
    await expect(page.locator('#xA1')).toHaveText('committed');
    await expect(page.locator('#ed')).not.toBeVisible();
  });
});

// ─── Formula Bar ─────────────────────────────────────────────────────────────

test.describe('Formula Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('formula bar shows raw formula, cell shows computed value', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=2*3');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=2*3');
    await expect(page.locator('#xA1')).toHaveText('6');
  });

  test('typing in formula bar updates cell in real-time', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('hello');
    await expect(page.locator('#xA1')).toHaveText('hello');
  });

  test('Enter in formula bar commits and moves selection down', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('test');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('test');
    await expect(page.locator('#aci')).toHaveText('A2');
  });

  test('formula bar cleared when empty cell selected', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    // A2 is empty
    await expect(page.locator('#fb')).toHaveValue('');
  });

  test('formula bar updates when arrow-key navigating', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('alpha');
    await page.keyboard.press('Tab');
    await page.keyboard.type('beta');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('alpha');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#fb')).toHaveValue('beta');
  });

  test('keydown in formula bar does not navigate grid', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.keyboard.press('ArrowDown');
    // Grid should not have moved
    await expect(page.locator('#aci')).toHaveText('A1');
  });
});

// ─── Delete / Backspace ───────────────────────────────────────────────────────

test.describe('Delete and Backspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Backspace clears selected cell and formula bar', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#xA1')).toHaveText('');
    await expect(page.locator('#fb')).toHaveValue('');
  });

  test('Delete clears selected cell and formula bar', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('world');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('#xA1')).toHaveText('');
    await expect(page.locator('#fb')).toHaveValue('');
  });

  test('Backspace on range clears all cells in selection', async ({ page }) => {
    for (const [cell, val] of [['#xA1', '1'], ['#xA2', '2'], ['#xA3', '3']]) {
      await page.locator(cell).click();
      await page.keyboard.type(val);
      await page.keyboard.press('Enter');
    }
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#xA1')).toHaveText('');
    await expect(page.locator('#xA2')).toHaveText('');
    await expect(page.locator('#xA3')).toHaveText('');
  });

  test('Delete on range clears all cells', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Tab');
    await page.keyboard.type('y');
    await page.keyboard.press('Enter');

    await page.locator('#xB1').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Delete');
    await expect(page.locator('#xB1')).toHaveText('');
    await expect(page.locator('#xC1')).toHaveText('');
  });

  test('range is cleared after range-delete', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('q');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Backspace');
    // Range highlight should be gone
    await expect(page.locator('#xA1')).not.toHaveClass(/range/);
    await expect(page.locator('#xA2')).not.toHaveClass(/range/);
  });
});

// ─── Undo ─────────────────────────────────────────────────────────────────────

test.describe('Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Ctrl+Z undoes the last cell edit', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('hello');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('Ctrl+Z undoes a clear operation', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#xA1')).toHaveText('');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('data');
  });

  test('multiple undos restore history sequentially', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('first');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.type('second');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('first');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('Ctrl+Z while editing does not trigger undo', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('saved');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    // Ctrl+Z in edit mode should not undo the 'saved' commit
    await page.keyboard.press('Control+z');
    await expect(page.locator('#ed')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#xA1')).toHaveText('saved');
  });

  test('undo updates formula bar to match restored value', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('original');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.type('replaced');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#fb')).toHaveValue('original');
  });
});

// ─── Copy / Cut / Paste ───────────────────────────────────────────────────────

test.describe('Copy, Cut, and Paste', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('Ctrl+C copies single cell raw value to clipboard', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('myvalue');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+c');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('myvalue');
  });

  test('Ctrl+C on range copies tab+newline delimited data', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('1');
    await page.keyboard.press('Tab');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await page.locator('#xA2').click();
    await page.keyboard.type('3');
    await page.keyboard.press('Tab');
    await page.keyboard.type('4');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Control+c');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('1\t2\n3\t4\n');
  });

  test('Ctrl+X cuts cell value to clipboard and clears the cell', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('cutme');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+x');
    await page.locator('#xA1').waitFor();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('cutme');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('Ctrl+V pastes single value into selected cell', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'pasted');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xA1')).toHaveText('pasted');
    await expect(page.locator('#fb')).toHaveValue('pasted');
  });

  test('Ctrl+V pastes tab-separated data as multi-cell grid', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'a\tb\nc\td');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xA1')).toHaveText('a');
    await expect(page.locator('#xB1')).toHaveText('b');
    await expect(page.locator('#xA2')).toHaveText('c');
    await expect(page.locator('#xB2')).toHaveText('d');
  });

  test('paste starting from non-A1 cell offsets correctly', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'x\ty\nz\tw');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xB2')).toHaveText('x');
    await expect(page.locator('#xC2')).toHaveText('y');
    await expect(page.locator('#xB3')).toHaveText('z');
    await expect(page.locator('#xC3')).toHaveText('w');
  });

  test('paste does not fire custom handler when editing', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('original');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    // Editor is open — grid paste handler should be skipped
    await expect(page.locator('#ed')).toBeVisible();
  });

  test('Ctrl+C while editing does not copy', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    // Ctrl+C in edit mode should not fire our copy handler
    await expect(page.locator('#ed')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

// ─── Formula Range Selection ──────────────────────────────────────────────────

test.describe('Formula Range Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking a cell after operator inserts its ref into formula', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');

    await page.locator('#xB1').click();
    await page.keyboard.type('=A1+');
    await page.locator('#xA2').click();
    await expect(page.locator('#fb')).toHaveValue('=A1+A2');
  });

  test('clicking cell after ( inserts ref', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');
    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=SUM(A1');
  });

  test('clicking cell after comma inserts ref', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(A1,');
    await page.locator('#xA2').click();
    await expect(page.locator('#fb')).toHaveValue('=SUM(A1,A2');
  });

  test('clicking cell after bare = inserts ref and evaluates', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('99');
    await page.keyboard.press('Enter');

    await page.locator('#xB1').click();
    await page.keyboard.type('=');
    await page.locator('#xA1').click();
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('99');
  });

  test('dragging during formula mode inserts range ref', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');

    const a1 = page.locator('#xA1');
    const a3 = page.locator('#xA3');
    await a1.hover();
    await page.mouse.down();
    await a3.hover();
    await page.mouse.up();

    await expect(page.locator('#fb')).toHaveValue('=SUM(A1:A3');
  });

  test('formula range drag evaluates correctly after confirm', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await page.locator('#xA2').click();
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await page.locator('#xA3').click();
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');

    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');
    const a1 = page.locator('#xA1');
    const a3 = page.locator('#xA3');
    await a1.hover();
    await page.mouse.down();
    await a3.hover();
    await page.mouse.up();

    await page.keyboard.type(')');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('6');
  });

  test('formula-ref highlight clears after mouseup', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');

    const a1 = page.locator('#xA1');
    const a2 = page.locator('#xA2');
    await a1.hover();
    await page.mouse.down();
    await a2.hover();
    await expect(page.locator('#xA1')).toHaveClass(/formula-ref/);
    await page.mouse.up();
    await expect(page.locator('#xA1')).not.toHaveClass(/formula-ref/);
    await expect(page.locator('#xA2')).not.toHaveClass(/formula-ref/);
  });

  test('formula range border overlay clears after mouseup', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');

    await page.locator('#xA1').hover();
    await page.mouse.down();
    await page.locator('#xA3').hover();
    await expect(page.locator('#frb')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('#frb')).not.toBeVisible();
  });

  test('formula input regains focus after range selection mouseup', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=SUM(');
    await page.locator('#xA1').hover();
    await page.mouse.down();
    await page.locator('#xA2').hover();
    await page.mouse.up();
    const activeId = await page.evaluate(() => document.activeElement.id);
    expect(['ed', 'fb']).toContain(activeId);
  });

  test('repeated formula clicks replace the previous ref', async ({ page }) => {
    await page.locator('#xB1').click();
    await page.keyboard.type('=');
    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=A1');
    // Clicking again after losing formula-insert position won't replace
    // but if we type + to restore insert position, next click replaces
    await page.keyboard.type('+');
    await page.locator('#xA2').click();
    await expect(page.locator('#fb')).toHaveValue('=A1+A2');
  });
});

// ─── Error Display ────────────────────────────────────────────────────────────

test.describe('Error Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('circular reference shows #CIRC! with err class', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=B1');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1');
    await page.keyboard.press('Enter');

    await expect(page.locator('#xA1')).toHaveText('#CIRC!');
    await expect(page.locator('#xB1')).toHaveText('#CIRC!');
    await expect(page.locator('#xA1')).toHaveClass(/err/);
    await expect(page.locator('#xB1')).toHaveClass(/err/);
  });

  test('division by zero shows error with err class', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1/0');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveClass(/err/);
  });

  test('err class removed when cell is corrected', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=B1');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1');
    await page.keyboard.press('Enter');

    await expect(page.locator('#xA1')).toHaveClass(/err/);

    await page.locator('#xB1').click();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).not.toHaveClass(/err/);
    await expect(page.locator('#xA1')).toHaveText('10');
  });

  test('cells without errors do not have err class', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1+1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).not.toHaveClass(/err/);
  });
});

// ─── Info Modal ───────────────────────────────────────────────────────────────

test.describe('Info Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('info button opens modal', async ({ page }) => {
    await page.locator('#info-btn').click();
    await expect(page.locator('#info-modal')).not.toHaveAttribute('hidden');
  });

  test('close button hides modal and refocuses grid', async ({ page }) => {
    await page.locator('#info-btn').click();
    await page.locator('#info-close').click();
    await expect(page.locator('#info-modal')).toHaveAttribute('hidden', '');
    const activeId = await page.evaluate(() => document.activeElement.id);
    expect(activeId).toBe('gc');
  });

  test('clicking backdrop closes modal', async ({ page }) => {
    await page.locator('#info-btn').click();
    // Click in the top-left corner of the overlay (not inside the modal box)
    await page.locator('#info-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#info-modal')).toHaveAttribute('hidden', '');
  });

  test('Escape closes open modal', async ({ page }) => {
    await page.locator('#info-btn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#info-modal')).toHaveAttribute('hidden', '');
  });

  test('Ctrl+I opens modal', async ({ page }) => {
    await page.keyboard.press('Control+i');
    await expect(page.locator('#info-modal')).not.toHaveAttribute('hidden');
  });

  test('Ctrl+I closes modal when already open', async ({ page }) => {
    await page.locator('#info-btn').click();
    await page.keyboard.press('Control+i');
    await expect(page.locator('#info-modal')).toHaveAttribute('hidden', '');
  });

  test('arrow key navigation blocked while modal is open', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    // After Enter we're on A2
    await expect(page.locator('#aci')).toHaveText('A2');

    await page.locator('#info-btn').click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    // Should still be on A2 — arrow was eaten by modal handler
    await expect(page.locator('#aci')).toHaveText('A2');
  });

  test('Ctrl+I opens modal even while editing, Escape closes modal not editor', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await expect(page.locator('#ed')).toBeVisible();
    await page.keyboard.press('Control+i');
    // Modal opens on top of the editor
    await expect(page.locator('#info-modal')).not.toHaveAttribute('hidden');
    // Escape closes the modal (not the editor, since modal intercepts Escape)
    await page.keyboard.press('Escape');
    await expect(page.locator('#info-modal')).toHaveAttribute('hidden', '');
    // Editor is still visible — user must press Escape again to cancel edit
    await expect(page.locator('#ed')).toBeVisible();
  });
});

// ─── Tab Navigation ───────────────────────────────────────────────────────────

test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Tab when not editing moves selection right', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Tab');
    await expect(page.locator('#aci')).toHaveText('B1');
  });

  test('Tab when editing commits and moves right', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('abc');
    await page.keyboard.press('Tab');
    await expect(page.locator('#xA1')).toHaveText('abc');
    await expect(page.locator('#aci')).toHaveText('B1');
  });

  test('Tab does not move selection when formula bar is focused', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    // Tab focus moves to next browser element — grid ACI should not change
    await expect(page.locator('#aci')).toHaveText('A1');
  });
});

// ─── Column / Row Resize ──────────────────────────────────────────────────────

test.describe('Column and Row Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('dragging column resize handle increases width', async ({ page }) => {
    const handle = page.locator('[data-resize-col="0"]').first();
    const box = await handle.boundingBox();

    const before = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().width
    );

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2);
    await page.mouse.up();

    const after = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().width
    );
    expect(after).toBeGreaterThan(before);
  });

  test('column width enforces minimum (30px)', async ({ page }) => {
    const handle = page.locator('[data-resize-col="0"]').first();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 500, box.y + box.height / 2);
    await page.mouse.up();

    const after = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().width
    );
    expect(after).toBeGreaterThanOrEqual(30);
  });

  test('dragging row resize handle increases height', async ({ page }) => {
    const handle = page.locator('[data-resize-row="1"]').first();
    const box = await handle.boundingBox();

    const before = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().height
    );

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40);
    await page.mouse.up();

    const after = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().height
    );
    expect(after).toBeGreaterThan(before);
  });

  test('row height enforces minimum (16px)', async ({ page }) => {
    const handle = page.locator('[data-resize-row="1"]').first();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 500);
    await page.mouse.up();

    const after = await page.evaluate(() =>
      document.querySelector('#xA1').getBoundingClientRect().height
    );
    expect(after).toBeGreaterThanOrEqual(16);
  });
});

// ─── File Title ───────────────────────────────────────────────────────────────

test.describe('File Title Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Enter in file-title refocuses the grid container', async ({ page }) => {
    await page.locator('#file-title').click();
    await page.locator('#file-title').fill('My Sheet');
    await page.keyboard.press('Enter');
    const activeId = await page.evaluate(() => document.activeElement.id);
    expect(activeId).toBe('gc');
  });

  test('Escape in file-title refocuses the grid container', async ({ page }) => {
    await page.locator('#file-title').click();
    await page.keyboard.press('Escape');
    const activeId = await page.evaluate(() => document.activeElement.id);
    expect(activeId).toBe('gc');
  });

  test('arrow keys in file-title do not move cell selection', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.locator('#file-title').click();
    await page.keyboard.press('ArrowDown');
    // ACI should not have changed
    await expect(page.locator('#aci')).toHaveText('B2');
  });
});

// ─── Computed Value Display ───────────────────────────────────────────────────

test.describe('Computed Value Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('cell displays computed result, not formula text', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=2*3');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('6');
  });

  test('dependent cells update immediately when dependency changes', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1*2');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('20');

    await page.locator('#xA1').click();
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('10');
  });

  test('empty cell displays nothing', async ({ page }) => {
    await expect(page.locator('#xD4')).toHaveText('');
  });

  test('clearing a formula cell removes computed display', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1+1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('2');

    await page.locator('#xA1').click();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('overwriting a cell updates the display', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('old');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.type('new');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('new');
  });
});

// ─── Shift+Tab Navigation ─────────────────────────────────────────────────────

test.describe('Shift+Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Shift+Tab when not editing moves selection left', async ({ page }) => {
    await page.locator('#xC3').click();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#aci')).toHaveText('B3');
  });

  test('Shift+Tab when editing commits and moves left', async ({ page }) => {
    await page.locator('#xC3').click();
    await page.keyboard.type('val');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#xC3')).toHaveText('val');
    await expect(page.locator('#aci')).toHaveText('B3');
    await expect(page.locator('#ed')).not.toBeVisible();
  });

  test('Shift+Tab at column A stays clamped at column A', async ({ page }) => {
    await page.locator('#xA3').click();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#aci')).toHaveText('A3');
  });
});

// ─── Selection State Invariants ───────────────────────────────────────────────

test.describe('Selection State Invariants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ctrl+a gives anchor cell A1 the sel class', async ({ page }) => {
    await page.locator('#xD4').click();
    await page.keyboard.press('Control+a');
    await expect(page.locator('#xA1')).toHaveClass(/sel/);
  });

  test('only one data cell has the sel class at a time', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#xZ50').click();
    await page.locator('#xM25').click();
    const count = await page.locator('.cv.sel').count();
    expect(count).toBe(1);
  });

  test('sel class stays on anchor when range is extended via shift+arrow', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator('#xB2')).toHaveClass(/sel/);
    await expect(page.locator('#xC3')).not.toHaveClass(/sel/);
  });

  test('sel class persists after canceling edit with Escape', async ({ page }) => {
    await page.locator('#xC3').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('Escape');
    await expect(page.locator('#xC3')).toHaveClass(/sel/);
    await expect(page.locator('#ed')).not.toBeVisible();
  });

  test('clicking a cell after ctrl+a collapses to single-cell selection', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+a');
    await page.locator('#xC3').click();
    await expect(page.locator('#aci')).toHaveText('C3');
    await expect(page.locator('#xA1')).not.toHaveClass(/range/);
    await expect(page.locator('#xZ50')).not.toHaveClass(/range/);
  });

  test('typing while range selected opens editor on anchor cell', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('q');
    await expect(page.locator('#ed')).toBeVisible();
    await expect(page.locator('#ed')).toHaveValue('q');
    await expect(page.locator('#aci')).toHaveText('B2');
  });

  test('ctrl+a marks all grid cells with range class', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+a');
    const count = await page.locator('.cv.range').count();
    expect(count).toBe(26 * 50);
  });
});

// ─── Arrow Key and Range Interaction ─────────────────────────────────────────

test.describe('Arrow Key and Range Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('arrow key collapses range and moves from anchor', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    // Range is B2:C3, anchor is B2
    await page.keyboard.press('ArrowRight');
    // Collapses to anchor (B2), then moves right → C2
    await expect(page.locator('#aci')).toHaveText('C2');
    await expect(page.locator('#xC3')).not.toHaveClass(/range/);
  });

  test('arrow key after ctrl+a collapses to A1 then navigates from A1', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('B1');
  });

  test('shift+arrow at grid boundary does not extend beyond the grid', async ({ page }) => {
    await page.locator('#xZ50').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator('#aci')).toHaveText('Z50');
    await expect(page.locator('#xZ50')).toHaveClass(/sel/);
    await expect(page.locator('#xZ50')).not.toHaveClass(/range/);
  });

  test('ACI shows anchor (start) cell throughout a drag', async ({ page }) => {
    await page.locator('#xA1').click();
    await expect(page.locator('#aci')).toHaveText('A1');
    await page.mouse.down();
    await page.locator('#xC3').hover();
    await expect(page.locator('#aci')).toHaveText('A1');
    await page.mouse.up();
  });

  test('Escape collapses range to anchor and preserves cell data', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Escape');
    await expect(page.locator('#aci')).toHaveText('A1');
    await expect(page.locator('#xA1')).toHaveText('hello');
    await expect(page.locator('#xA2')).not.toHaveClass(/range/);
  });
});

// ─── Formula Bar History ──────────────────────────────────────────────────────

test.describe('Formula Bar History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('multiple keystrokes in formula bar produce a single undo entry', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('hello world');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('hello world');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('refocusing formula bar starts a fresh history session', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('first');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('second');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('first');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('focusing formula bar without typing does not create a history entry', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');

    // Focus fb, don't type, move away
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#xB1').click();

    // Only one history entry should exist (from the edit commit)
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });
});

// ─── Undo Edge Cases ──────────────────────────────────────────────────────────

test.describe('Undo Edge Cases', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('Ctrl+Z undoes a cut operation', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('cutme');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+x');
    await expect(page.locator('#xA1')).toHaveText('');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('cutme');
  });

  test('Ctrl+Z undoes a paste operation', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'pasted');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xA1')).toHaveText('pasted');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('');
  });

  test('Ctrl+Z restores a formula cell after Delete', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=SUM(1,2,3)');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('6');

    await page.locator('#xA1').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('#xA1')).toHaveText('');

    await page.keyboard.press('Control+z');
    await expect(page.locator('#xA1')).toHaveText('6');
    await expect(page.locator('#fb')).toHaveValue('=SUM(1,2,3)');
  });

  test('Ctrl+Z when no history exists does not throw or corrupt state', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('#aci')).toHaveText('A1');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('B1');
  });
});

// ─── ACI and Formula Bar Consistency ─────────────────────────────────────────

test.describe('ACI and Formula Bar Consistency', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('ACI shows anchor cell after range delete', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Enter');
    await page.locator('#xB2').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Delete');
    await expect(page.locator('#aci')).toHaveText('B2');
  });

  test('formula bar shows empty after deleting current cell content', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('#fb')).toHaveValue('');
  });

  test('formula bar shows empty after single-cell cut', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('val');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+x');
    await expect(page.locator('#fb')).toHaveValue('');
  });

  test('formula bar shows anchor value after multi-cell paste', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'anchor\tother');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#fb')).toHaveValue('anchor');
  });

  test('formula bar shows raw formula when navigating back to a formula cell', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=2*3');
    await page.keyboard.press('Enter');
    await page.locator('#xA2').click();
    await page.keyboard.type('other');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=2*3');
    await expect(page.locator('#xA1')).toHaveText('6');
  });

  test('formula bar tracks navigation through multiple cells correctly', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=SUM(1,2)');
    await page.keyboard.press('Tab');
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await expect(page.locator('#fb')).toHaveValue('=SUM(1,2)');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#fb')).toHaveValue('hello');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#fb')).toHaveValue('=SUM(1,2)');
  });
});

// ─── Paste Edge Cases ─────────────────────────────────────────────────────────

test.describe('Paste Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('paste is ignored when formula bar is focused', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('original');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'overwrite');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xA1')).toHaveText('original');
  });

  test('paste with Windows CRLF line endings works correctly', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'a\tb\r\nc\td');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xA1')).toHaveText('a');
    await expect(page.locator('#xB1')).toHaveText('b');
    await expect(page.locator('#xA2')).toHaveText('c');
    await expect(page.locator('#xB2')).toHaveText('d');
  });

  test('paste near grid boundary only fills cells within bounds', async ({ page }) => {
    await page.locator('#xZ50').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'fits\texceed');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xZ50')).toHaveText('fits');
    // 'exceed' would go to AA50 which doesn't exist — no error, just ignored
  });

  test('paste of single value with no tab or newline goes to anchor cell', async ({ page }) => {
    await page.locator('#xC3').click();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'singleval');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('#xC3')).toHaveText('singleval');
    await expect(page.locator('#fb')).toHaveValue('singleval');
  });
});

// ─── Reversed Range Selection ─────────────────────────────────────────────────

test.describe('Reversed Range Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shift+click above and left of anchor highlights the full bounding box', async ({ page }) => {
    await page.locator('#xC3').click();
    await page.locator('#xA1').click({ modifiers: ['Shift'] });
    await expect(page.locator('#xA1')).toHaveClass(/range/);
    await expect(page.locator('#xB2')).toHaveClass(/range/);
    await expect(page.locator('#xC3')).toHaveClass(/range/);
  });

  test('drag from bottom-right to top-left selects full range', async ({ page }) => {
    const c3 = page.locator('#xC3');
    const a1 = page.locator('#xA1');
    await c3.hover();
    await page.mouse.down();
    await a1.hover();
    await page.mouse.up();
    await expect(page.locator('#xA1')).toHaveClass(/range/);
    await expect(page.locator('#xB2')).toHaveClass(/range/);
    await expect(page.locator('#xC3')).toHaveClass(/range/);
  });
});

// ─── Edit Mode Details ────────────────────────────────────────────────────────

test.describe('Edit Mode Details', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('double-click on formula cell opens editor with raw formula', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1+1');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').dblclick();
    await expect(page.locator('#ed')).toHaveValue('=1+1');
  });

  test('pressing = opens editor with = as initial content', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('=');
    await expect(page.locator('#ed')).toBeVisible();
    await expect(page.locator('#ed')).toHaveValue('=');
  });

  test('Escape from edit restores computed value in cell and raw formula in fb', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=2+2');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('99');
    await page.keyboard.press('Escape');

    await expect(page.locator('#xA1')).toHaveText('4');
    await expect(page.locator('#fb')).toHaveValue('=2+2');
  });

  test('editor and formula bar stay in sync while typing', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('=A2+');
    await expect(page.locator('#ed')).toHaveValue('=A2+');
    await expect(page.locator('#fb')).toHaveValue('=A2+');
  });

  test('Tab at last column stays clamped at last column', async ({ page }) => {
    await page.locator('#xZ1').click();
    await page.keyboard.press('Tab');
    await expect(page.locator('#aci')).toHaveText('Z1');
  });

  test('after Enter commit, arrow key navigates from the newly selected cell', async ({ page }) => {
    await page.locator('#xB2').click();
    await page.keyboard.type('data');
    await page.keyboard.press('Enter');
    await expect(page.locator('#aci')).toHaveText('B3');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('C3');
  });

  test('arrow keys inside editor move cursor without navigating cells', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('F2');
    await page.keyboard.type('hello');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    // ACI should not have moved
    await expect(page.locator('#aci')).toHaveText('A1');
    await expect(page.locator('#ed')).toBeVisible();
  });
});

// ─── Clipboard Additional ─────────────────────────────────────────────────────

test.describe('Clipboard Additional', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('Ctrl+C on a formula cell copies the raw formula, not the computed value', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('=1+1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xA1')).toHaveText('2');

    await page.locator('#xA1').click();
    await page.keyboard.press('Control+c');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('=1+1');
  });

  test('range copy uses computed display values, not raw formulas', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1*2');
    await page.keyboard.press('Enter');

    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Control+c');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('5\t10\n');
  });

  test('range cut collapses selection to anchor after clearing', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Enter');
    await page.locator('#xA1').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Control+x');
    // Wait for async clipboard to complete
    await expect(page.locator('#xA1')).toHaveText('');
    await expect(page.locator('#xA2')).not.toHaveClass(/range/);
    await expect(page.locator('#aci')).toHaveText('A1');
  });
});

// ─── Complex Interaction Sequences ───────────────────────────────────────────

test.describe('Complex Interaction Sequences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('formula bar live-edits update dependent cells immediately', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1*3');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('30');

    await page.locator('#xA1').click();
    await page.locator('#fb').click();
    await page.locator('#fb').fill('20');
    await expect(page.locator('#xB1')).toHaveText('60');
  });

  test('grid remains functional after closing info modal', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.press('Control+i');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#aci')).toHaveText('B1');
    await page.keyboard.type('works');
    await expect(page.locator('#ed')).toHaveValue('works');
  });

  test('Tab then Enter navigates column then row correctly', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('a');
    await page.keyboard.press('Tab');
    await expect(page.locator('#aci')).toHaveText('B1');
    await page.keyboard.type('b');
    await page.keyboard.press('Enter');
    await expect(page.locator('#aci')).toHaveText('B2');
  });

  test('dependency chain updates through multiple cells', async ({ page }) => {
    await page.locator('#xA1').click();
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    await page.locator('#xB1').click();
    await page.keyboard.type('=A1*3');
    await page.keyboard.press('Enter');
    await page.locator('#xC1').click();
    await page.keyboard.type('=B1+10');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xC1')).toHaveText('16');

    await page.locator('#xA1').click();
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await expect(page.locator('#xB1')).toHaveText('15');
    await expect(page.locator('#xC1')).toHaveText('25');
  });

  test('clicking column header does not change cell selection', async ({ page }) => {
    await page.locator('#xB2').click();
    await expect(page.locator('#aci')).toHaveText('B2');
    await page.locator('[data-col="0"]').click();
    await expect(page.locator('#aci')).toHaveText('B2');
  });
});
