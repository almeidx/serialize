import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";
import { serialize } from "./serialize.js";

describe("UTF-8 handling", () => {
	it("round-trips strings with 4-byte code points", () => {
		const input = 's:5:"A😀";';
		const parsed = parse(input);

		expect(parsed).toEqual({ type: "string", value: "A😀" });
		expect(serialize(parsed)).toBe(input);
	});

	it("rejects declared byte lengths that cut through a UTF-8 sequence", () => {
		expect(() => parse('s:1:"é";')).toThrow(/does not align with UTF-8 sequence/);
	});

	it("rejects unpaired UTF-16 surrogates during parse", () => {
		expect(() => parse(`s:3:"${String.fromCharCode(0xd800)}";`)).toThrow(/unpaired surrogate/);
	});

	it("rejects unpaired UTF-16 surrogates during serialize", () => {
		for (const value of [String.fromCharCode(0xdc00), `a${String.fromCharCode(0xd800)}`]) {
			expect(() => serialize({ type: "string", value })).toThrow(/unpaired surrogate/);
		}
	});
});
