import { fromJson, toJson } from "#lib/converter/json.js";
import type { JsonValue } from "#lib/converter/types.js";
import { parse } from "#lib/parser/parse.js";
import { serialize } from "#lib/parser/serialize.js";
import { computeStats, type Stats } from "#lib/stats.js";

export type InputMode = "php" | "json";

export interface InputResult {
	data: JsonValue;
	serialized: string;
	stats: Stats;
}

export interface DataResult {
	/** `data` rendered back in the current input mode. */
	input: string;
	serialized: string;
	stats: Stats;
}

const PHP_PREFIX = /^(?:N;|b:[01];|i:-?\d+;|d:[^;]+;|s:\d+:|a:\d+:\{|O:\d+:|C:\d+:|E:\d+:|[Rr]:\d+;)/;

/** Guesses the format of freshly pasted text; `null` when it is neither. */
export function detectFormat(text: string): InputMode | null {
	const trimmed = text.trim();
	if (PHP_PREFIX.test(trimmed)) return "php";
	if (!/^(?:[[{"]|true|false|null|-?\d)/.test(trimmed)) return null;
	try {
		JSON.parse(trimmed);
		return "json";
	} catch {
		return null;
	}
}

/** Parses non-blank input. Throws a descriptive error when it is invalid. */
export function processInput(mode: InputMode, text: string): InputResult {
	if (mode === "php") {
		const trimmed = text.trim();
		const value = parse(trimmed);
		return { data: toJson(value), serialized: serialize(value), stats: computeStats(value, trimmed) };
	}

	const data = JSON.parse(text) as JsonValue;
	const value = fromJson(data);
	const serialized = serialize(value);
	return { data, serialized, stats: computeStats(value, serialized) };
}

export function processData(mode: InputMode, data: JsonValue): DataResult {
	const value = fromJson(data);
	const serialized = serialize(value);
	return {
		input: mode === "php" ? serialized : JSON.stringify(data, null, 2),
		serialized,
		stats: computeStats(value, serialized),
	};
}
