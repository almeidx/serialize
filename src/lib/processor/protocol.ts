import type { JsonValue } from "#lib/converter/types.js";
import type { DataResult, InputMode, InputResult } from "./process.js";

export interface RequestResults {
	input: InputResult;
	data: DataResult;
}

export type WorkerCall =
	| { type: "input"; mode: InputMode; text: string }
	| { type: "data"; mode: InputMode; data: JsonValue };

export type WorkerRequest = WorkerCall & { id: number };

export type WorkerResponse =
	| { id: number; type: "result"; value: RequestResults[WorkerCall["type"]] }
	| { id: number; type: "error"; message: string };
