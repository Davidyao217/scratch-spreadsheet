import { test, expect } from '@playwright/test';

test.describe('Spreadsheet E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow basic data entry and calculation', async ({ page }) => {
    // 1. Click A1 and type 10
    const cellA1 = page.locator('#xA1');
    await cellA1.click();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');

    // 2. Click A2 and type 20
    const cellA2 = page.locator('#xA2');
    await cellA2.click();
    await page.keyboard.type('20');
    await page.keyboard.press('Enter');

    // 3. Click A3 and type =A1+A2
    const cellA3 = page.locator('#xA3');
    await cellA3.click();
    await page.keyboard.type('=A1+A2');
    await page.keyboard.press('Enter');

    // Verify A3 displays the result 30
    await expect(cellA3).toHaveText('30');
  });

  test('should synchronize formula bar', async ({ page }) => {
    const cellB1 = page.locator('#xB1');
    const formulaBar = page.locator('#fb');

    // Select cell and type formula via keyboard
    await cellB1.click();
    await page.keyboard.type('=SUM(1, 2, 3)');
    await page.keyboard.press('Enter');

    // Select cell again, verify formula bar shows the raw formula
    await cellB1.click();
    await expect(formulaBar).toHaveValue('=SUM(1, 2, 3)');
    // Verify the cell itself shows the computed value
    await expect(cellB1).toHaveText('6');
  });
});
