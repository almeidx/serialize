import { browser } from "$app/env";

export type Theme = "light" | "dark";
export type OutputView = "tree" | "json";

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	if (!browser) return fallback;
	try {
		const value = localStorage.getItem(key);
		return allowed.includes(value as T) ? (value as T) : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage can be disabled; the setting still applies for this page.
	}
}

/**
 * Viewer preferences, persisted per browser. `static/theme-init.js` applies the theme before first paint.
 * User input is never persisted.
 */
class Settings {
	#theme = $state<Theme>(browser && document.documentElement.dataset.theme === "light" ? "light" : "dark");
	#view = $state<OutputView>(read("output-view", ["tree", "json"], "tree"));
	#stats = $state(read("stats", ["on", "off"], "on") === "on");

	get theme(): Theme {
		return this.#theme;
	}

	set theme(value: Theme) {
		this.#theme = value;
		document.documentElement.dataset.theme = value;
		write("theme", value);
	}

	get view(): OutputView {
		return this.#view;
	}

	set view(value: OutputView) {
		this.#view = value;
		write("output-view", value);
	}

	get stats(): boolean {
		return this.#stats;
	}

	set stats(value: boolean) {
		this.#stats = value;
		write("stats", value ? "on" : "off");
	}
}

export const settings = new Settings();
