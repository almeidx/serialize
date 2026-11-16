import type { Handlers, WorkerRequest, WorkerResponse } from "./worker.js";

interface Pending {
	resolve: (value: unknown) => void;
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
		if (data.ok) entry.resolve(data.value);
		else entry.reject(new Error(data.message));
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

/** Runs a `process.ts` function in the worker. Arguments are structured-cloned, so pass raw (non-proxied) state. */
export function run<K extends keyof Handlers>(
	type: K,
	...args: Parameters<Handlers[K]>
): Promise<ReturnType<Handlers[K]>> {
	const { promise, resolve, reject } = Promise.withResolvers<ReturnType<Handlers[K]>>();
	const id = nextId++;
	pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
	getWorker().postMessage({ id, type, args } as WorkerRequest);
	return promise;
}
