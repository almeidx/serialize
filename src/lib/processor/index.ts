import { fromJson, toJson, type JsonValue } from "$lib/converter";
import { parse, serialize as phpSerialize } from "$lib/parser";
import { computeStats, type Stats } from "$lib/stats";
import type { InputMode } from "./types";

export interface ProcessInputResult {
	parsedData: JsonValue | undefined;
	phpSerializedValue: string;
	stats: Stats | null;
}

export interface ProcessParsedResult {
	inputValue: string;
	phpSerializedValue: string;
	stats: Stats;
}

export function processInputValue(inputMode: InputMode, inputValue: string): ProcessInputResult {
	if (!inputValue.trim()) {
		return {
			parsedData: undefined,
			phpSerializedValue: "",
			stats: null,
		};
	}

	if (inputMode === "php") {
		const trimmed = inputValue.trim();
		const phpValue = parse(trimmed);
		return {
			parsedData: toJson(phpValue),
			phpSerializedValue: phpSerialize(phpValue),
			stats: computeStats(phpValue, trimmed),
		};
	}

	const json = JSON.parse(inputValue) as JsonValue;
	const phpValue = fromJson(json);
	const serialized = phpSerialize(phpValue);
	return {
		parsedData: json,
		phpSerializedValue: serialized,
		stats: computeStats(phpValue, serialized),
	};
}

export function processParsedData(parsedData: JsonValue, inputMode: InputMode): ProcessParsedResult {
	const phpValue = fromJson(parsedData);
	const serialized = phpSerialize(phpValue);

	return {
		inputValue: inputMode === "php" ? serialized : JSON.stringify(parsedData, null, 2),
		phpSerializedValue: serialized,
		stats: computeStats(phpValue, serialized),
	};
}
