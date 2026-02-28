import { describe, expect, it } from "vitest";

import { parse } from "./parse";
import { serialize } from "./serialize";
import type { PhpValue } from "./types";

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

	it("rejects unmatched UTF-16 surrogate pairs during parse", () => {
		const loneHighSurrogate = String.fromCharCode(0xd800);
		const input = `s:3:"${loneHighSurrogate}";`;
		expect(() => parse(input)).toThrow(/unmatched high surrogate/);
	});

	it("rejects invalid UTF-16 strings during serialize", () => {
		const loneLowSurrogate = String.fromCharCode(0xdc00);
		const value: PhpValue = {
			type: "string",
			value: loneLowSurrogate,
		};

		expect(() => serialize(value)).toThrow(/unexpected low surrogate/);
	});
});
