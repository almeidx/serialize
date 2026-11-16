import type { JsonValue } from "#lib/converter/types.js";
import { applyOperation, type TreeOperation } from "#lib/tree/operations.js";
import { run } from "./client.js";
import { detectFormat, type InputMode } from "./process.js";
import type { Stats } from "./stats.js";

const EXAMPLES: Record<InputMode, string> = {
	php: 'a:4:{s:4:"user";O:4:"User":2:{s:4:"name";s:5:"Alice";s:5:"email";s:17:"alice@example.com";}s:5:"roles";a:2:{i:0;s:5:"admin";i:1;s:4:"user";}s:9:"loginTime";i:1704067200;s:8:"isActive";b:1;}',
	json: JSON.stringify(
		{
			user: { name: "Alice", email: "alice@example.com" },
			roles: ["admin", "user"],
			loginTime: 1704067200,
			isActive: true,
		},
		null,
		2,
	),
};

/**
 * The editor's single source of truth. `data` is what both the tree and the
 * JSON view render and edit; `input` is re-derived from it after every edit.
 * Each change supersedes any still-running one, so stale results are dropped.
 */
export class Session {
	mode = $state<InputMode>("php");
	input = $state("");
	/** `undefined` while the input is blank or invalid. Kept raw: it is cloned to the worker. */
	data = $state.raw<JsonValue | undefined>(undefined);
	serialized = $state("");
	stats = $state.raw<Stats | null>(null);
	error = $state<string | null>(null);

	#latest = 0;

	/** Text typed or pasted into the input editor. The format is detected when it replaces blank input. */
	setInput(text: string): void {
		if (!this.input.trim()) this.mode = detectFormat(text) ?? this.mode;
		this.input = text;
		void this.#parse();
	}

	/** Switches the input format, converting the current value when there is one. */
	setMode(mode: InputMode): void {
		if (mode === this.mode) return;
		this.mode = mode;
		if (this.data === undefined) void this.#parse();
		else void this.#sync(this.data);
	}

	edit(op: TreeOperation): void {
		if (this.data === undefined) return;
		this.data = applyOperation(this.data, op);
		void this.#sync(this.data);
	}

	/** Text from the JSON output view; ignored until it is valid JSON. */
	setJson(text: string): void {
		let data: JsonValue;
		try {
			data = JSON.parse(text) as JsonValue;
		} catch {
			return;
		}
		this.data = data;
		void this.#sync(data);
	}

	loadExample(): void {
		this.input = EXAMPLES[this.mode];
		void this.#parse();
	}

	clear(): void {
		this.input = "";
		void this.#parse();
	}

	#reset(error: string | null): void {
		this.data = undefined;
		this.serialized = "";
		this.stats = null;
		this.error = error;
	}

	async #parse(): Promise<void> {
		const id = ++this.#latest;
		if (!this.input.trim()) {
			this.#reset(null);
			return;
		}
		try {
			const result = await run("input", this.mode, this.input);
			if (id !== this.#latest) return;
			this.data = result.data;
			this.serialized = result.serialized;
			this.stats = result.stats;
			this.error = null;
		} catch (error) {
			if (id === this.#latest) this.#reset((error as Error).message);
		}
	}

	async #sync(data: JsonValue): Promise<void> {
		const id = ++this.#latest;
		try {
			const result = await run("data", this.mode, data);
			if (id !== this.#latest) return;
			this.input = result.input;
			this.serialized = result.serialized;
			this.stats = result.stats;
			this.error = null;
		} catch (error) {
			if (id === this.#latest) this.error = (error as Error).message;
		}
	}
}
