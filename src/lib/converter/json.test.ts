import { describe, expect, it } from "vitest";

import type { PhpValue } from "../parser";
import { fromJson, toJson, type JsonValue } from "./json";

describe("fromJson metadata validation", () => {
	it("converts PHP array wrappers with typed original keys", () => {
		const json: JsonValue = {
			__php_type__: "array",
			__php_original_keys__: [
				{ type: "int", value: 1 },
				{ type: "string", value: "foo" },
			],
			data: {
				1: "one",
				foo: "bar",
			},
		};

		expect(fromJson(json)).toEqual({
			type: "array",
			entries: [
				{
					key: { type: "int", value: 1 },
					value: { type: "string", value: "one" },
				},
				{
					key: { type: "string", value: "foo" },
					value: { type: "string", value: "bar" },
				},
			],
		});
	});

	it("rejects malformed reference metadata", () => {
		const malformed = {
			__php_type__: "reference",
			__php_ref_index__: "1",
			__php_ref_object__: true,
		} as unknown as JsonValue;

		expect(() => fromJson(malformed)).toThrow(/integer __php_ref_index__/);
	});

	it("rejects array metadata that references missing keys", () => {
		const malformed: JsonValue = {
			__php_type__: "array",
			__php_original_keys__: [{ type: "string", value: "missing" }],
			data: {},
		};

		expect(() => fromJson(malformed)).toThrow(/missing from data/);
	});

	it("rejects invalid __php_data_keys__ metadata", () => {
		const malformed: JsonValue = {
			__php_type__: "array",
			__php_original_keys__: [{ type: "int", value: 1 }],
			__php_data_keys__: ["1", "1#2"],
			data: { "1": "one" },
		};

		expect(() => fromJson(malformed)).toThrow(/__php_data_keys__ length/i);
	});

	it("rejects invalid binary string payloads", () => {
		const malformed: JsonValue = {
			__php_type__: "string",
			__php_binary__: true,
			value: "%%%not-base64%%%",
		};

		expect(() => fromJson(malformed)).toThrow(/invalid base64/i);
	});

	it("rejects visibility metadata for non-existent properties", () => {
		const malformed: JsonValue = {
			__php_type__: "object",
			__php_class__: "User",
			__php_visibility__: { missing: "private" },
			data: { name: "Alice" },
		};

		expect(() => fromJson(malformed)).toThrow(/missing property 'missing'/);
	});

	it("rejects malformed object property metadata entries", () => {
		const malformed: JsonValue = {
			__php_type__: "object",
			__php_class__: "User",
			__php_property_meta__: {
				name: {
					name: "name",
					visibility: "invalid",
				},
			},
			data: { name: "Alice" },
		};

		expect(() => fromJson(malformed)).toThrow(/valid 'visibility'/);
	});

	it("rejects invalid object property order metadata", () => {
		const malformed: JsonValue = {
			__php_type__: "object",
			__php_class__: "User",
			__php_property_order__: ["name", "name"],
			data: { name: "Alice" },
		};

		expect(() => fromJson(malformed)).toThrow(/duplicate key/);
	});

	it("rejects invalid custom object wrappers", () => {
		const malformed: JsonValue = {
			__php_type__: "custom_object",
			__php_class__: "Foo",
			__php_payload_base64__: "%%%%",
		};

		expect(() => fromJson(malformed)).toThrow(/invalid base64 payload/i);
	});

	it("rejects invalid enum wrappers", () => {
		const malformed: JsonValue = {
			__php_type__: "enum",
			__php_class__: "Suit",
			__php_enum_case__: "",
		};

		expect(() => fromJson(malformed)).toThrow(/non-empty '__php_enum_case__'/);
	});

	it("rejects unresolved references after conversion", () => {
		const malformed: JsonValue = {
			__php_type__: "array",
			__php_original_keys__: [{ type: "int", value: 0 }],
			data: {
				0: {
					__php_type__: "reference",
					__php_ref_index__: 9,
					__php_ref_object__: false,
				},
			},
		};

		expect(() => fromJson(malformed)).toThrow(/unresolved value/);
	});

	it("rejects object references to non object-like targets", () => {
		const malformed: JsonValue = {
			__php_type__: "array",
			__php_original_keys__: [
				{ type: "int", value: 0 },
				{ type: "int", value: 1 },
			],
			data: {
				0: "foo",
				1: {
					__php_type__: "reference",
					__php_ref_index__: 2,
					__php_ref_object__: true,
				},
			},
		};

		expect(() => fromJson(malformed)).toThrow(/object-like value/);
	});
});

describe("toJson/fromJson round-trip", () => {
	it("preserves object metadata across conversion", () => {
		const input: PhpValue = {
			type: "object",
			className: "User",
			properties: [
				{
					name: "name",
					visibility: "public",
					value: { type: "string", value: "Alice" },
				},
				{
					name: "password",
					visibility: "private",
					className: "User",
					value: { type: "string", value: "secret" },
				},
			],
		};

		expect(fromJson(toJson(input))).toEqual({
			type: "object",
			className: "User",
			properties: [
				{
					name: "name",
					visibility: "public",
					className: undefined,
					value: { type: "string", value: "Alice" },
				},
				{
					name: "password",
					visibility: "private",
					className: "User",
					value: { type: "string", value: "secret" },
				},
			],
		});
	});

	it("preserves binary string wrappers", () => {
		const input: PhpValue = {
			type: "string",
			value: `a${String.fromCharCode(0)}b`,
			binary: true,
		};

		expect(fromJson(toJson(input))).toEqual(input);
	});

	it("preserves UTF-8 binary payloads with non-latin characters", () => {
		const input: PhpValue = {
			type: "string",
			value: `${String.fromCharCode(0)}😀`,
			binary: true,
		};

		expect(fromJson(toJson(input))).toEqual(input);
	});

	it("preserves reference wrappers", () => {
		const validGraph: PhpValue = {
			type: "array",
			entries: [
				{
					key: { type: "int", value: 0 },
					value: { type: "string", value: "foo" },
				},
				{
					key: { type: "int", value: 1 },
					value: { type: "reference", index: 2, isObject: false },
				},
			],
		};

		expect(fromJson(toJson(validGraph))).toEqual(validGraph);
	});

	it("preserves associative arrays with typed key metadata", () => {
		const input: PhpValue = {
			type: "array",
			entries: [
				{
					key: { type: "int", value: 1 },
					value: { type: "string", value: "one" },
				},
				{
					key: { type: "string", value: "foo" },
					value: { type: "int", value: 42 },
				},
			],
		};

		const json = toJson(input) as Record<string, JsonValue>;
		expect(json.__php_type__).toBe("array");
		expect(json.__php_original_keys__).toEqual([
			{ type: "int", value: 1 },
			{ type: "string", value: "foo" },
		]);
		expect(fromJson(json)).toEqual(input);
	});

	it("preserves colliding int/string array keys using data key metadata", () => {
		const input: PhpValue = {
			type: "array",
			entries: [
				{
					key: { type: "int", value: 1 },
					value: { type: "string", value: "int" },
				},
				{
					key: { type: "string", value: "1" },
					value: { type: "string", value: "str" },
				},
			],
		};

		const json = toJson(input) as Record<string, JsonValue>;
		expect(json.__php_data_keys__).toEqual(["1", "1#2"]);
		expect((json.data as Record<string, JsonValue>)["1"]).toBe("int");
		expect((json.data as Record<string, JsonValue>)["1#2"]).toBe("str");
		expect(fromJson(json)).toEqual(input);
	});

	it("preserves duplicate object property names using property metadata", () => {
		const input: PhpValue = {
			type: "object",
			className: "User",
			properties: [
				{
					name: "value",
					visibility: "private",
					className: "Base",
					value: { type: "string", value: "base" },
				},
				{
					name: "value",
					visibility: "private",
					className: "User",
					value: { type: "string", value: "user" },
				},
			],
		};

		const json = toJson(input) as Record<string, JsonValue>;
		expect(json.__php_property_order__).toEqual(["value", "value#2"]);
		expect(fromJson(json)).toEqual(input);
	});

	it("preserves custom objects and enums", () => {
		const customObject: PhpValue = {
			type: "custom_object",
			className: "Foo",
			payload: `a${String.fromCharCode(0)}b`,
			binary: true,
		};
		const enumValue: PhpValue = {
			type: "enum",
			className: "Suit",
			caseName: "Hearts",
		};

		expect(fromJson(toJson(customObject))).toEqual(customObject);
		expect(fromJson(toJson(enumValue))).toEqual(enumValue);
	});
});
