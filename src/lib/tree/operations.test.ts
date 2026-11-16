import { describe, expect, it } from "vitest";
import { fromJson, toJson } from "#lib/converter/json.js";
import type { JsonValue } from "#lib/converter/types.js";
import { parse } from "#lib/parser/parse.js";
import { serialize } from "#lib/parser/serialize.js";
import { buildTree } from "./nodes.js";
import { applyOperation, type TreeOperation, type TreePath } from "./operations.js";

/** Path of the node reached by following child positions from the document, as the tree view addresses it. */
function pathAt(data: JsonValue, ...positions: number[]): TreePath {
	let node = buildTree(data).children[0];
	for (const position of positions) node = node.children[position];
	return node.path;
}

/** Applies `edit` to `php` read through the JSON representation, and serializes the result. */
function edited(php: string, edit: (data: JsonValue) => TreeOperation): string {
	const data = toJson(parse(php));
	return serialize(fromJson(applyOperation(data, edit(data))));
}

describe("applyOperation", () => {
	it("sets values inside PHP arrays and objects", () => {
		const php = 'a:2:{s:1:"b";i:1;s:4:"user";O:4:"User":1:{s:4:"name";s:5:"Alice";}}';
		expect(edited(php, (data) => ({ type: "set", path: pathAt(data, 1, 0), value: "Bob" }))).toBe(
			'a:2:{s:1:"b";i:1;s:4:"user";O:4:"User":1:{s:4:"name";s:3:"Bob";}}',
		);
	});

	it("deletes the right entry when int and string keys collide", () => {
		const php = 'a:2:{i:1;s:3:"int";s:1:"1";s:3:"str";}';
		expect(edited(php, (data) => ({ type: "delete", path: pathAt(data, 1) }))).toBe('a:1:{i:1;s:3:"int";}');
		expect(edited(php, (data) => ({ type: "delete", path: pathAt(data, 0) }))).toBe('a:1:{s:1:"1";s:3:"str";}');
	});

	it("adds integer-like keys to PHP arrays as int keys, next to a colliding string key", () => {
		const php = 'a:1:{s:1:"1";s:1:"a";}';
		expect(edited(php, (data) => ({ type: "add", path: pathAt(data), key: "1", value: "b" }))).toBe(
			'a:2:{s:1:"1";s:1:"a";i:1;s:1:"b";}',
		);
		expect(edited(php, (data) => ({ type: "add", path: pathAt(data), key: "01", value: "b" }))).toBe(
			'a:2:{s:1:"1";s:1:"a";s:2:"01";s:1:"b";}',
		);
	});

	it("refuses to add a key that already exists, starting from PHP's next index", () => {
		const php = 'a:2:{i:5;s:1:"a";s:1:"x";s:1:"b";}';
		const data = toJson(parse(php));
		const document = buildTree(data).children[0];
		expect(document.addKey).toBe("6");
		expect(applyOperation(data, { type: "add", path: document.path, key: "5", value: "c" })).toBe(data);
		expect(applyOperation(data, { type: "add", path: document.path, key: "x", value: "c" })).toBe(data);
	});

	it("keeps property visibility when adding and deleting object properties", () => {
		const php = 'O:4:"User":2:{s:4:"name";s:5:"Alice";s:7:"\0*\0pass";s:1:"x";}';
		expect(edited(php, (data) => ({ type: "delete", path: pathAt(data, 0) }))).toBe(
			'O:4:"User":1:{s:7:"\0*\0pass";s:1:"x";}',
		);
		expect(edited(php, (data) => ({ type: "add", path: pathAt(data), key: "1", value: 2 }))).toBe(
			'O:4:"User":3:{s:4:"name";s:5:"Alice";s:7:"\0*\0pass";s:1:"x";s:1:"1";i:2;}',
		);
	});

	it("inserts into lists at an index, appends past the end and ignores non-index keys", () => {
		const list: JsonValue = ["a", "c"];
		expect(applyOperation(list, { type: "add", path: [], key: "1", value: "b" })).toEqual(["a", "b", "c"]);
		expect(applyOperation(list, { type: "add", path: [], key: "10", value: "d" })).toEqual(["a", "c", "d"]);
		expect(applyOperation(list, { type: "add", path: [], key: "x", value: "d" })).toBe(list);
	});

	it("edits plain JSON objects, treating keys starting with __php_ as data", () => {
		const data: JsonValue = { __php_note: 1, b: { c: 1, keep: 2 } };
		expect(applyOperation(data, { type: "set", path: pathAt(data, 0), value: 2 })).toEqual({
			__php_note: 2,
			b: { c: 1, keep: 2 },
		});
		expect(applyOperation(data, { type: "delete", path: pathAt(data, 1, 0) })).toEqual({
			__php_note: 1,
			b: { keep: 2 },
		});
	});

	it("leaves the data unchanged when the path no longer exists", () => {
		const data: JsonValue = { nested: { value: 1 } };
		expect(applyOperation(data, { type: "set", path: ["missing", "value"], value: 2 })).toBe(data);
		expect(applyOperation(data, { type: "delete", path: ["nested", "missing"] })).toBe(data);
		expect(applyOperation(data, { type: "add", path: ["missing"], key: "k", value: 1 })).toBe(data);
	});
});
