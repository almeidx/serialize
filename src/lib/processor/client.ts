import type { JsonValue } from "#lib/converter/types.js";
import type { DataResult, InputMode, InputResult } from "./process.js";
import type { RequestResults, WorkerCall, WorkerRequest, WorkerResponse } from "./protocol.js";

interface Pending {
	resolve: (value: never) => void;
	reject: (error: Error) => void;
}

/** Parsing and serializing large values runs off the main thread so typing stays responsive. */
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
	if (worker) return worker;

	worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "processor" });
	worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
		const entry = pending.get(data.id);
		if (!entry) return;
		pending.delete(data.id);
		if (data.type === "error") entry.reject(new Error(data.message));
		else entry.resolve(data.value as never);
	};
	worker.onerror = (event) => {
		event.preventDefault();
		worker?.terminate();
		worker = null;
		const error = new Error("Processing crashed, most likely because the input is too large.");
		for (const entry of pending.values()) entry.reject(error);
		pending.clear();
	};
	return worker;
}

function call<T extends WorkerCall["type"]>(message: Extract<WorkerCall, { type: T }>): Promise<RequestResults[T]> {
	const { promise, resolve, reject } = Promise.withResolvers<RequestResults[T]>();
	const id = nextId++;
	pending.set(id, { resolve, reject });
	getWorker().postMessage({ ...message, id } satisfies WorkerRequest);
	return promise;
}

export function processInput(mode: InputMode, text: string): Promise<InputResult> {
	return call({ type: "input", mode, text });
}

/** `data` must be plain (e.g. from `$state.raw`): it is structured-cloned to the worker. */
export function processData(mode: InputMode, data: JsonValue): Promise<DataResult> {
	return call({ type: "data", mode, data });
}
