import { describe, expect, it } from "vitest";
import { detectFormat, processData, processInput } from "./process.js";

describe("processor", () => {
	it("processes php input into json, serialized output, and stats", () => {
		const result = processInput("php", 'a:1:{i:0;s:3:"foo";}');

		expect(result.data).toEqual(["foo"]);
		expect(result.serialized).toBe('a:1:{i:0;s:3:"foo";}');
		expect(result.stats.nodeCount).toBe(3);
	});

	it("processes json input into php and stats", () => {
		const result = processInput("json", '{"count":1}');

		expect(result.data).toEqual({ count: 1 });
		expect(result.serialized).toBe('a:1:{s:5:"count";i:1;}');
		expect(result.stats.types).toEqual({ array: 1, string: 1, int: 1 });
	});

	it("renders edited data back in the active input mode", () => {
		const data = { user: "alice" };
		const php = processData("php", data);
		const json = processData("json", data);

		expect(php.input).toBe(php.serialized);
		expect(json.input).toBe(JSON.stringify(data, null, 2));
	});

	it("keeps PHP types through the JSON representation", () => {
		const php = 'a:3:{s:1:"f";d:1;s:1:"r";a:1:{i:0;i:2;}s:1:"x";R:3;}';
		expect(processData("php", processInput("php", php).data).serialized).toBe(php);
		expect(processInput("json", '{"5":1,"05":2}').serialized).toBe('a:2:{i:5;i:1;s:2:"05";i:2;}');
	});

	it("detects the format of pasted text", () => {
		expect(detectFormat(" a:0:{}")).toBe("php");
		expect(detectFormat('{"a":1}')).toBe("json");
		expect(detectFormat("{not json")).toBeNull();
		expect(detectFormat("hello")).toBeNull();
	});
});
