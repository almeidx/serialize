import { fromJson, toJson } from "#lib/converter/json.js";
import type { JsonValue } from "#lib/converter/types.js";
import { looksSerialized, parse } from "#lib/parser/parse.js";
import { serialize } from "#lib/parser/serialize.js";
import type { PhpValue } from "#lib/parser/types.js";
import { computeStats, type Stats } from "./stats.js";

export type InputMode = "php" | "json";

interface Output {
	serialized: string;
	stats: Stats;
}

export interface InputResult extends Output {
	data: JsonValue;
}

export interface DataResult extends Output {
	/** `data` rendered back in the current input mode. */
	input: string;
}

/** Guesses the format of freshly pasted text; `null` when it is neither. */
export function detectFormat(text: string): InputMode | null {
	const trimmed = text.trim();
	if (looksSerialized(trimmed)) return "php";
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
		const value = parse(text.trim());
		return { data: toJson(value), ...output(value) };
	}
	const data = JSON.parse(text) as JsonValue;
	return { data, ...output(fromJson(data)) };
}

export function processData(mode: InputMode, data: JsonValue): DataResult {
	const result = output(fromJson(data));
	return { input: mode === "php" ? result.serialized : JSON.stringify(data, null, 2), ...result };
}

function output(value: PhpValue): Output {
	const serialized = serialize(value);
	return { serialized, stats: computeStats(value, serialized) };
}
