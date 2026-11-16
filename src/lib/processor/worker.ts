/// <reference lib="webworker" />
import { processData, processInput } from "./process.js";
import type { WorkerRequest, WorkerResponse } from "./protocol.js";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = ({ data: request }: MessageEvent<WorkerRequest>) => {
	let response: WorkerResponse;
	try {
		const value =
			request.type === "input" ? processInput(request.mode, request.text) : processData(request.mode, request.data);
		response = { id: request.id, type: "result", value };
	} catch (error) {
		response = { id: request.id, type: "error", message: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(response);
};
