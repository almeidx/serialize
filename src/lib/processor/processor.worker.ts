import { processInputValue, processParsedData } from "$lib/processor";
import type { ProcessorWorkerRequest, ProcessorWorkerResponse } from "$lib/processor/worker-protocol";

const worker = globalThis as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void };

worker.onmessage = (event: MessageEvent<ProcessorWorkerRequest>) => {
	const request = event.data;

	try {
		if (request.type === "process-input") {
			const result = processInputValue(request.inputMode, request.inputValue);
			const response: ProcessorWorkerResponse = {
				id: request.id,
				ok: true,
				type: "process-input",
				result,
			};
			worker.postMessage(response);
			return;
		}

		const result = processParsedData(request.parsedData, request.inputMode);
		const response: ProcessorWorkerResponse = {
			id: request.id,
			ok: true,
			type: "process-parsed",
			result,
		};
		worker.postMessage(response);
	} catch (error) {
		const response: ProcessorWorkerResponse = {
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
		worker.postMessage(response);
	}
};
