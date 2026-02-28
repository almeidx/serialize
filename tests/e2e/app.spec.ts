import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";

async function waitForClientReady(page: Page): Promise<void> {
	await expect(page.getByRole("textbox", { name: "Editor content" }).first()).toBeVisible({
		timeout: 15_000,
	});
}

async function setInputMode(page: Page, mode: "PHP" | "JSON"): Promise<void> {
	await waitForClientReady(page);
	await page.getByRole("radiogroup", { name: "Input format" }).getByRole("radio", { name: mode, exact: true }).click();
}

async function setInputEditorValue(page: Page, value: string): Promise<void> {
	const inputEditor = page.getByRole("textbox", { name: "Editor content" }).first();
	await inputEditor.focus();
	await page.keyboard.press(selectAllShortcut);
	await page.keyboard.insertText(value);
}

test("tree edit works for keys that contain dots", async ({ page }) => {
	await page.goto("/");
	await setInputMode(page, "JSON");
	await setInputEditorValue(page, '{"user.name":"alice"}');

	await expect(page.getByText("user.name").first()).toBeVisible();
	await expect(page.getByRole("button", { name: '"alice"' }).first()).toBeVisible();
	await expect(page.getByText("Parse Error")).toHaveCount(0);
});

test("split handle exposes keyboard and pointer slider semantics", async ({ page }) => {
	await page.goto("/");
	const handle = page.getByRole("slider", { name: "Resize panels" });

	await expect(handle).toBeVisible();
	await expect(handle).toHaveAttribute("aria-valuemin", "20");
	await expect(handle).toHaveAttribute("aria-valuemax", "80");

	const beforeKeyboard = Number(await handle.getAttribute("aria-valuenow"));
	await handle.focus();
	await page.keyboard.press("ArrowRight");
	const afterKeyboard = Number(await handle.getAttribute("aria-valuenow"));
	expect(afterKeyboard).toBeGreaterThan(beforeKeyboard);

	const box = await handle.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
	await page.mouse.up();

	const afterPointer = Number(await handle.getAttribute("aria-valuenow"));
	expect(afterPointer).toBeGreaterThan(afterKeyboard);
});

test("mobile shows stats summary after parsing", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await setInputMode(page, "JSON");
	await setInputEditorValue(page, '{"count":1}');

	await expect(page.getByText(/^Stats:/)).toBeVisible();
});

test("copy menu supports keyboard navigation and escape to close", async ({ page }) => {
	await page.goto("/");
	await setInputMode(page, "JSON");
	await setInputEditorValue(page, '{"count":1}');

	const copyButton = page.getByRole("button", { name: /^Copy/ });
	await copyButton.click();
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();

	await page.keyboard.press("ArrowDown");
	await expect(menu).toBeVisible();

	await page.keyboard.press("End");
	await expect(menu).toBeVisible();

	await page.keyboard.press("Home");
	await expect(menu).toBeVisible();

	await page.keyboard.type("php");
	await expect(menu).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(page.getByRole("menu")).toHaveCount(0);
});

test("toggle groups and collapsible expose state semantics", async ({ page }) => {
	await page.goto("/");
	await waitForClientReady(page);

	const inputMode = page.getByRole("radiogroup", { name: "Input format" });
	const php = inputMode.getByRole("radio", { name: "PHP", exact: true });
	const json = inputMode.getByRole("radio", { name: "JSON", exact: true });
	await expect(php).toHaveAttribute("aria-checked", "true");
	await expect(json).toHaveAttribute("aria-checked", "false");

	await json.click();
	await expect(json).toHaveAttribute("aria-checked", "true");

	const outputMode = page.getByRole("radiogroup", { name: "Output view" });
	const tree = outputMode.getByRole("radio", { name: "Tree", exact: true });
	const outputJson = outputMode.getByRole("radio", { name: "JSON", exact: true });
	await expect(tree).toHaveAttribute("aria-checked", "true");
	await outputJson.click();
	await expect(outputJson).toHaveAttribute("aria-checked", "true");

	await page.getByRole("button", { name: "Example", exact: true }).click();
	const collapse = page.getByRole("button", { name: "Collapse stats" });
	await expect(collapse).toHaveAttribute("aria-expanded", "true");
	await collapse.click();

	const expand = page.getByRole("button", { name: "Expand stats" });
	await expect(expand).toHaveAttribute("aria-expanded", "false");
	await expand.click();
	await expect(page.getByRole("button", { name: "Collapse stats" })).toHaveAttribute("aria-expanded", "true");
});

test("tree supports keyboard navigation keys", async ({ page }) => {
	await page.goto("/");
	await setInputMode(page, "JSON");
	await setInputEditorValue(page, '{"a":{"x":1},"b":[1,2],"c":3}');

	const tree = page.getByRole("tree", { name: "Editable parsed data tree" });
	await expect(tree).toBeVisible();

	const navigableNodes = tree.locator(
		'[data-scope="tree-view"][data-part="branch-control"], [data-scope="tree-view"][data-part="item"]',
	);
	const firstNode = navigableNodes.first();
	await firstNode.focus();
	await expect(firstNode).toBeFocused();

	await page.keyboard.press("ArrowDown");
	await expect(navigableNodes.nth(1)).toBeFocused();

	await page.keyboard.press("ArrowUp");
	await expect(firstNode).toBeFocused();

	await page.keyboard.press("ArrowLeft");
	await expect(firstNode).toHaveAttribute("data-state", "closed");

	await page.keyboard.press("ArrowRight");
	await expect(firstNode).toHaveAttribute("data-state", "open");

	await page.keyboard.press("End");
	await expect(navigableNodes.last()).toBeFocused();

	await page.keyboard.press("Home");
	await expect(firstNode).toBeFocused();
});

test("invalid negative structural counts surface parse errors", async ({ page }) => {
	await page.goto("/");
	await setInputMode(page, "PHP");
	await setInputEditorValue(page, "a:-1:{}");

	await expect(page.getByText("Parse Error")).toBeVisible();
	await expect(page.getByText(/non-negative integer.*array element count/i)).toBeVisible();
});

test("blocking localStorage does not break app bootstrap", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new Error("localStorage is blocked");
			},
		});
	});

	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Serialize" })).toBeVisible();
	await expect(page.getByText("Paste PHP serialized data or JSON in the input panel to get started")).toBeVisible();
});

test("monaco runtime does not request external CDN assets", async ({ page }) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		requests.push(request.url());
	});

	await page.goto("/");
	await setInputMode(page, "JSON");
	await page.waitForTimeout(500);

	const disallowedDomains = ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "skypack.dev", "esm.sh"];

	const disallowedRequests = requests.filter((url) => disallowedDomains.some((domain) => url.includes(domain)));
	expect(disallowedRequests).toEqual([]);
});

test("axe scan has no serious or critical wcag2a/wcag2aa violations", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Example", exact: true }).click();

	const axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".monaco-editor");
	const results = await axe.analyze();

	const blockingViolations = results.violations.filter((violation) => {
		return violation.impact === "serious" || violation.impact === "critical";
	});

	expect(
		blockingViolations,
		blockingViolations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
	).toEqual([]);
});
