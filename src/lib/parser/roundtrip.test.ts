import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";
import { serialize } from "./serialize.js";

describe("parser/serializer round-trip fixtures", () => {
	it("round-trips strings with control characters", () => {
		const input = `s:5:"a${String.fromCharCode(0)}b${String.fromCharCode(0)}c";`;
		const parsed = parse(input);

		expect(parsed).toEqual({
			type: "string",
			value: `a${String.fromCharCode(0)}b${String.fromCharCode(0)}c`,
		});
		expect(serialize(parsed)).toBe(input);
	});

	it("round-trips object property visibility metadata", () => {
		const input = `O:4:"User":4:{s:4:"name";s:5:"Alice";s:5:"${String.fromCharCode(0)}*${String.fromCharCode(0)}id";i:7;s:14:"${String.fromCharCode(0)}User${String.fromCharCode(0)}password";s:6:"secret";s:12:"${String.fromCharCode(0)}Admin${String.fromCharCode(0)}token";s:3:"abc";}`;
		const parsed = parse(input);

		expect(parsed).toEqual({
			type: "object",
			className: "User",
			properties: [
				{
					name: "name",
					visibility: "public",
					value: { type: "string", value: "Alice" },
				},
				{
					name: "id",
					visibility: "protected",
					value: { type: "int", value: 7 },
				},
				{
					name: "password",
					visibility: "private",
					className: undefined,
					value: { type: "string", value: "secret" },
				},
				{
					name: "token",
					visibility: "private",
					className: "Admin",
					value: { type: "string", value: "abc" },
				},
			],
		});
		expect(serialize(parsed)).toBe(input);
	});

	it("round-trips value, object and self references, numbering slots as PHP does", () => {
		for (const input of [
			'a:2:{i:0;s:3:"foo";i:1;R:2;}',
			'a:2:{i:0;O:3:"Foo":0:{}i:1;r:2;}',
			'O:3:"Foo":1:{s:4:"self";r:1;}',
			'a:4:{i:0;i:1;i:1;R:2;i:2;O:1:"A":0:{}i:3;r:3;}',
		]) {
			expect(serialize(parse(input))).toBe(input);
		}
	});

	it("round-trips custom objects and enums", () => {
		const customObject = 'C:3:"Foo":5:{a\x00b\x00c}';
		const enumValue = 'E:11:"Suit:Hearts";';

		expect(serialize(parse(customObject))).toBe(customObject);
		expect(parse(enumValue)).toEqual({
			type: "enum",
			className: "Suit",
			caseName: "Hearts",
		});
		expect(serialize(parse(enumValue))).toBe(enumValue);
	});
});
