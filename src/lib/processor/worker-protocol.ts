import type { JsonValue } from "$lib/converter";
import type { ProcessInputResult, ProcessParsedResult } from "$lib/processor";
import type { InputMode } from "./types";

export interface ProcessInputRequest {
	id: number;
	type: "process-input";
	inputMode: InputMode;
	inputValue: string;
}

export interface ProcessParsedRequest {
	id: number;
	type: "process-parsed";
	inputMode: InputMode;
	parsedData: JsonValue;
}

export type ProcessorWorkerRequest = ProcessInputRequest | ProcessParsedRequest;

export type ProcessorWorkerResponse =
	| {
			id: number;
			ok: true;
			type: "process-input";
			result: ProcessInputResult;
	  }
	| {
			id: number;
			ok: true;
			type: "process-parsed";
			result: ProcessParsedResult;
	  }
	| {
			id: number;
			ok: false;
			error: string;
	  };
