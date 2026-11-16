/// <reference lib="webworker" />
import { processData, processInput } from "./process.js";

const handlers = { input: processInput, data: processData };

export type Handlers = typeof handlers;

export type WorkerRequest = {
	[K in keyof Handlers]: { id: number; type: K; args: Parameters<Handlers[K]> };
}[keyof Handlers];

export type WorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; message: string };

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = ({ data: { id, type, args } }: MessageEvent<WorkerRequest>) => {
	let response: WorkerResponse;
	try {
		response = { id, ok: true, value: (handlers[type] as (...args: unknown[]) => unknown)(...args) };
	} catch (error) {
		response = { id, ok: false, message: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(response);
};
