import { describe, expect, it } from "vitest";
import { detectFormat, processData, processInput } from "./process";

describe("processor", () => {
	it("processes php input into json, serialized output, and stats", () => {
		const result = processInput("php", 'a:1:{i:0;s:3:"foo";}');

		expect(result.data).toEqual(["foo"]);
		expect(result.serialized).toBe('a:1:{i:0;s:3:"foo";}');
		expect(result.stats.nodeCount).toBeGreaterThan(0);
	});

	it("processes json input into php and stats", () => {
		const result = processInput("json", '{"count":1}');

		expect(result.data).toEqual({ count: 1 });
		expect(result.serialized).toBe('a:1:{s:5:"count";i:1;}');
		expect(result.stats.types.object ?? 0).toBe(0);
		expect(result.stats.types.array ?? 0).toBeGreaterThan(0);
	});

	it("renders edited data back in the active input mode", () => {
		const data = { user: "alice" };
		const php = processData("php", data);
		const json = processData("json", data);

		expect(php.input).toBe(php.serialized);
		expect(json.input).toBe(JSON.stringify(data, null, 2));
	});

	it("detects the format of pasted text", () => {
		expect(detectFormat(" a:0:{}")).toBe("php");
		expect(detectFormat('{"a":1}')).toBe("json");
		expect(detectFormat("{not json")).toBeNull();
		expect(detectFormat("hello")).toBeNull();
	});
});
