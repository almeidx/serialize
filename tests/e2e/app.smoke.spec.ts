import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function inputEditor(page: Page) {
	return page.getByRole("textbox", { name: "Input" });
}

/** Rendered text of the input editor (Monaco virtualizes lines, so keep inputs short). */
function inputText(page: Page) {
	return page.getByRole("region", { name: "Input" }).locator(".view-lines");
}

async function typeInput(page: Page, value: string): Promise<void> {
	const editor = inputEditor(page);
	await editor.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText(value);
}

test("home page is prerendered with hardened headers and a strict CSP", async ({ page }) => {
	const response = await page.goto("/");
	expect(response!.status()).toBe(200);
	const headers = response!.headers();
	expect(headers["x-frame-options"]).toBe("DENY");
	expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");

	const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("connect-src 'self'");

	await expect(page.getByRole("heading", { name: "PHP serialized data editor" })).toBeAttached();
	await expect(inputEditor(page)).toBeVisible();
});

test("the example parses into the tree and converts between input formats", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Load an example" }).click();

	const tree = page.getByRole("tree", { name: "Parsed data" });
	await expect(tree.getByRole("treeitem", { name: /"Alice"/ })).toBeVisible();
	await expect(page.getByText(/\d+ nodes · depth \d+/)).toBeVisible();

	await page.getByRole("radiogroup", { name: "Input format" }).getByRole("radio", { name: "JSON" }).click();
	await expect(inputText(page)).toContainText('"__php_class__": "User"');

	await page.getByRole("radio", { name: "PHP", exact: true }).click();
	await expect(inputText(page)).toContainText('O:4:"User":2:');
});

test("pasting JSON into blank input switches the input format", async ({ page }) => {
	await page.goto("/");
	await typeInput(page, '{"count":1}');

	await expect(
		page.getByRole("radiogroup", { name: "Input format" }).getByRole("radio", { name: "JSON" }),
	).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("treeitem", { name: /count/ })).toBeVisible();
});

test("tree edits update the serialized input", async ({ page }) => {
	await page.goto("/");
	await typeInput(page, 'a:2:{s:4:"name";s:5:"Alice";s:4:"tags";a:1:{i:0;s:1:"x";}}');

	await page.getByRole("treeitem", { name: /name/ }).click();
	const value = page.getByRole("textbox", { name: "Value of name" });
	await value.fill("Bob");
	await value.press("Enter");
	await expect(inputText(page)).toContainText('s:4:"name";s:3:"Bob";');

	await page.getByRole("button", { name: "Add item to tags" }).click();
	await page.getByRole("textbox", { name: "New index in tags" }).press("Enter");
	await expect(inputText(page)).toContainText('a:2:{i:0;s:1:"x";i:1;s:0:"";}');

	await page.getByRole("button", { name: "Delete name" }).click();
	await expect(inputText(page)).not.toContainText("Bob");

	await page.getByRole("combobox", { name: "Type of tags" }).selectOption("null");
	await expect(inputText(page)).toContainText('s:4:"tags";N;');
});

test("tree supports keyboard navigation", async ({ page }) => {
	await page.goto("/");
	await typeInput(page, '{"a":{"x":1},"b":[1,2],"c":3}');

	// Branches are focused through their control; leaves are the treeitem itself.
	const nodes = page
		.getByRole("tree", { name: "Parsed data" })
		.locator('[data-part="branch-control"], [data-part="item"]');
	const document = nodes.first();
	await document.focus();
	await page.keyboard.press("ArrowDown");
	await expect(nodes.nth(1)).toBeFocused();
	await page.keyboard.press("ArrowUp");
	await expect(document).toBeFocused();
	await page.keyboard.press("ArrowLeft");
	await expect(document).toHaveAttribute("data-state", "closed");
	await page.keyboard.press("ArrowRight");
	await expect(document).toHaveAttribute("data-state", "open");
});

test("invalid input reports the parse error", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("radio", { name: "PHP", exact: true }).click();
	await typeInput(page, "a:-1:{}");
	await expect(page.locator("p[role=alert]")).toContainText(/non-negative integer.*array element count/i);
});

test("output view, stats and theme preferences persist across reloads", async ({ page }) => {
	await page.goto("/");
	const theme = await page.locator("html").getAttribute("data-theme");
	await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
	await page.getByRole("radiogroup", { name: "Input format" }).getByRole("radio", { name: "JSON" }).click();
	await page.getByRole("button", { name: "Example", exact: true }).click();
	await page.getByRole("radiogroup", { name: "Output view" }).getByRole("radio", { name: "JSON" }).click();
	await page.getByRole("button", { name: "Stats" }).click();
	await page.reload();

	await expect(page.locator("html")).not.toHaveAttribute("data-theme", theme!);
	await expect(
		page.getByRole("radiogroup", { name: "Output view" }).getByRole("radio", { name: "JSON" }),
	).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("button", { name: "Stats" })).toHaveAttribute("aria-pressed", "false");
});

test("the split handle resizes the panes from the keyboard", async ({ page }) => {
	await page.goto("/");
	const handle = page.getByRole("separator", { name: "Resize panels" });
	await expect(handle).toHaveAttribute("aria-valuenow", "50");
	await handle.focus();
	await page.keyboard.press("ArrowRight");
	await expect(handle).toHaveAttribute("aria-valuenow", "52");
	await page.keyboard.press("End");
	await expect(handle).toHaveAttribute("aria-valuenow", "80");
});

test("blocked storage does not break the app and no CDN is contacted", async ({ page }) => {
	const requests: string[] = [];
	page.on("request", (request) => requests.push(new URL(request.url()).host));
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new Error("localStorage is blocked");
			},
		});
	});

	await page.goto("/");
	await page.getByRole("button", { name: "Load an example" }).click();
	await expect(page.getByRole("tree", { name: "Parsed data" })).toBeVisible();
	expect(new Set(requests)).toEqual(new Set(["127.0.0.1:4399"]));
});

test("unknown paths render the 404 page", async ({ page }) => {
	const response = await page.goto("/does/not/exist");
	expect(response!.status()).toBe(404);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
	await page.getByRole("link", { name: "Open the editor" }).click();
	await expect(inputEditor(page)).toBeVisible();
});

test("has no serious or critical WCAG 2 A/AA violations in either theme", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Load an example" }).click();
	await expect(page.getByRole("tree", { name: "Parsed data" })).toBeVisible();

	for (let pass = 0; pass < 2; pass++) {
		const { violations } = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.exclude(".monaco-editor")
			.analyze();
		const blocking = violations.filter(
			(violation) => violation.impact === "serious" || violation.impact === "critical",
		);
		expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
		await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();
	}
});

test.describe("mobile", () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test("panes stack and the stats summary stays visible", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("button", { name: "Load an example" }).click();
		await expect(page.getByText(/\d+ nodes · depth \d+/)).toBeVisible();
		await expect(page.getByRole("separator", { name: "Resize panels" })).toBeHidden();
		const output = await page.getByRole("region", { name: "Output" }).boundingBox();
		expect(output!.x + output!.width).toBeLessThanOrEqual(375);
	});
});
