import { describe, expect, it } from "vitest";
import { toJson } from "#lib/converter/json.js";
import type { JsonValue } from "#lib/converter/types.js";
import { parse } from "#lib/parser/parse.js";
import { buildTree, convert, defaultExpanded, parseEdit, type TreeNode } from "./nodes.js";

function rows(data: JsonValue): Array<[TreeNode["key"], TreeNode["kind"], string, string | undefined]> {
	return buildTree(data).children[0].children.map((node) => [node.key, node.kind, node.summary, node.editText]);
}

describe("buildTree", () => {
	it("shows every PHP value kind with its PHP key", () => {
		const php =
			'a:9:{i:5;d:INF;s:1:"s";s:3:"a\0b";i:1;C:3:"Foo":1:{x}i:2;E:6:"S:Hear";i:3;R:2;i:4;O:4:"User":0:{}' +
			's:1:"l";a:2:{i:0;b:1;i:1;N;}s:1:"t";s:2:"hi";s:1:"f";d:1.5;}';
		expect(rows(toJson(parse(php)))).toEqual([
			[5, "number", "INF", "INF"],
			["s", "binary", "[binary: YQBi]", undefined],
			[1, "custom_object", "custom(Foo)", undefined],
			[2, "enum", "S::Hear", undefined],
			[3, "reference", "ref(2)", undefined],
			[4, "object", "User", undefined],
			["l", "array", "Array(2)", undefined],
			["t", "string", '"hi"', "hi"],
			["f", "number", "1.5", "1.5"],
		]);
	});

	it("labels colliding PHP keys by their key, keeping their paths apart", () => {
		const [int, string] = buildTree(toJson(parse('a:2:{i:1;s:1:"a";s:1:"1";s:1:"b";}'))).children[0].children;
		expect([int.key, string.key]).toEqual([1, "1"]);
		expect(int.id).not.toBe(string.id);
	});

	it("shows a malformed wrapper as the plain object it is", () => {
		expect(rows({ x: { __php_type__: "enum", __php_class__: "S" } })).toEqual([
			["x", "object", "Object(2)", undefined],
		]);
	});

	it("expands the document and its direct children by default", () => {
		const root = buildTree({ a: { b: { c: 1 } }, d: 1 });
		expect(defaultExpanded(root)).toEqual([root.children[0].id, root.children[0].children[0].id]);
	});
});

describe("inline editing", () => {
	const [text, number, flag, int, wholeFloat] = buildTree(
		toJson(parse('a:5:{i:0;s:1:"7";i:1;d:2.5;i:2;b:1;i:3;i:4;i:4;d:1;}')),
	).children[0].children;

	it("keeps string input verbatim and parses other input as JSON or PHP float names", () => {
		expect(parseEdit(text, "[1]")).toBe("[1]");
		expect(parseEdit(int, "3")).toBe(3);
		expect(parseEdit(int, "-INF")).toEqual({ __php_type__: "float", value: "-INF" });
		expect(parseEdit(flag, "5")).toBe(5);
		expect(parseEdit(flag, "nope")).toBeUndefined();
	});

	it("keeps PHP floats floats when edited to whole numbers", () => {
		expect(parseEdit(number, "3")).toEqual({ __php_type__: "float", value: 3 });
		expect(parseEdit(wholeFloat, "1")).toEqual({ __php_type__: "float", value: 1 });
		expect(parseEdit(wholeFloat, "1.5")).toBe(1.5);
	});

	it("converts values between kinds", () => {
		expect(convert(text, "number")).toBe(7);
		expect(convert(number, "string")).toBe("2.5");
		expect(convert(flag, "null")).toBeNull();
		expect(convert(number, "array")).toEqual([]);
	});
});
