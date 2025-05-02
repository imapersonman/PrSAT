import { test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('textbox', { name: 'Enter constraint' }).click();
  await page.getByRole('textbox', { name: 'Enter constraint' }).fill('Pr(A & B) = Pr(A) * Pr(B)');
  await page.getByRole('button', { name: 'Find Model' }).click();
  await page.getByText('Regular').check();
  await page.getByRole('button', { name: 'Find Model' }).click();
  await page.getByRole('textbox', { name: 'Enter expression' }).click();
  await page.getByRole('textbox', { name: 'Enter expression' }).fill('Pr(A -> B)');
  await page.getByRole('textbox', { name: 'Enter expression' }).press('Enter');
  await page.getByRole('textbox', { name: 'Enter expression' }).nth(1).fill('Pr(B -> A)');
  await page.locator('html').click();
});
