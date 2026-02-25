import { expect, test } from '@playwright/test';

test('tree edit works for keys that contain dots', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'JSON' }).first().click();

	await page.locator('.monaco-editor').first().click();
	await page.keyboard.press('Meta+A');
	await page.keyboard.insertText('{"user.name":"alice"}');

	await expect(page.getByText('user.name').first()).toBeVisible();
	await expect(page.locator('button', { hasText: '"alice"' }).first()).toBeVisible();
	await expect(page.getByText('Parse Error')).toHaveCount(0);
});

test('split handle exposes keyboard-accessible slider semantics', async ({ page }) => {
	await page.goto('/');
	const handle = page.getByRole('slider', { name: 'Resize panels' });
	await expect(handle).toBeVisible();
	await expect(handle).toHaveAttribute('aria-valuemin', '20');
	await expect(handle).toHaveAttribute('aria-valuemax', '80');
});

test('mobile shows stats summary after parsing', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'JSON' }).first().click();
	await page.locator('.monaco-editor').first().click();
	await page.keyboard.press('Meta+A');
	await page.keyboard.insertText('{"count":1}');

	await expect(page.getByText(/^Stats:/)).toBeVisible();
});

test('copy menu supports escape to close', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'JSON' }).first().click();
	await page.locator('.monaco-editor').first().click();
	await page.keyboard.press('Meta+A');
	await page.keyboard.insertText('{"count":1}');

	const copyButton = page.getByRole('button', { name: /^Copy/ });
	await copyButton.click();
	await expect(page.getByRole('menu')).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toHaveCount(0);
});
