import { toJson } from "#lib/converter/json.js";
import type { JsonValue } from "#lib/converter/types.js";
import { encodeBase64Utf8 } from "#lib/converter/wrappers.js";
import { formatFloat, parseNonFiniteFloat } from "#lib/parser/float.js";
import type { TreePath } from "./operations.js";
import { children, nextKey, shape, type Shape } from "./shape.js";

export type Kind =
	| "string"
	| "number"
	| "boolean"
	| "null"
	| "array"
	| "object"
	| "binary"
	| "reference"
	| "custom_object"
	| "enum";

/** Kinds a node can be converted to from the tree. */
export const EDITABLE_KINDS = ["string", "number", "boolean", "null", "array", "object"] as const;
export type EditableKind = (typeof EDITABLE_KINDS)[number];

export function isEditableKind(kind: Kind): kind is EditableKind {
	return (EDITABLE_KINDS as readonly Kind[]).includes(kind);
}

export interface TreeNode {
	/** Stable across edits for the same path, so expansion survives updates. */
	id: string;
	path: TreePath;
	/** Displayed key; `null` for the root value. */
	key: string | number | null;
	value: JsonValue;
	kind: Kind;
	/** Inline text for the row: the value for scalars, a short summary otherwise. */
	summary: string;
	/** Text for the inline editor; `undefined` when the value is not editable in place. */
	editText: string | undefined;
	/** Key an add starts from; `undefined` when the value takes no children. */
	addKey: string | undefined;
	children: TreeNode[];
}

const PREVIEW_LIMIT = 100;

/** A synthetic root holding the document as its only child, so the top-level value gets a row too. */
export function buildTree(data: JsonValue): TreeNode {
	return {
		id: "tree",
		path: [],
		key: null,
		value: null,
		kind: "null",
		summary: "",
		editText: undefined,
		addKey: undefined,
		children: [buildNode(data, [], null)],
	};
}

/** Ids expanded on first render: the document and its direct children. */
export function defaultExpanded(root: TreeNode): string[] {
	const document = root.children[0];
	return [document, ...document.children].filter((node) => node.children.length > 0).map((node) => node.id);
}

/** Value typed into the inline editor; `undefined` when it is not valid for the node. A PHP float stays a float. */
export function parseEdit(node: TreeNode, text: string): JsonValue | undefined {
	if (node.kind === "string") return text;

	let value = node.kind === "number" ? parseNonFiniteFloat(text.trim()) : undefined;
	if (value === undefined) {
		let parsed: JsonValue;
		try {
			parsed = JSON.parse(text) as JsonValue;
		} catch {
			return undefined;
		}
		if (typeof parsed !== "number") return parsed;
		value = parsed;
	}

	const read = shape(node.value);
	const wasFloat =
		read.type === "float" ||
		(read.type === "scalar" && typeof read.value === "number" && !Number.isInteger(read.value));
	return wasFloat || !Number.isFinite(value) ? toJson({ type: "float", value }) : value;
}

export function convert(node: TreeNode, to: EditableKind): JsonValue {
	switch (to) {
		case "string":
			return node.kind === "number" ? node.summary : "";
		case "number":
			return node.kind === "string" ? Number(node.value) || 0 : 0;
		case "boolean":
			return Boolean(node.value);
		case "null":
			return null;
		case "array":
			return [];
		case "object":
			return {};
	}
}

function buildNode(value: JsonValue, path: TreePath, key: string | number | null): TreeNode {
	const read = shape(value);
	const nodeChildren = children(read).map((child) => buildNode(child.value, [...path, child.key], child.label));
	const kind = kindOf(read);
	const summary = summarize(read, nodeChildren.length);
	return {
		id: nodeId(path),
		path,
		key,
		value,
		kind,
		summary,
		editText:
			kind === "string"
				? (value as string)
				: kind === "number" || kind === "boolean" || kind === "null"
					? summary
					: undefined,
		children: nodeChildren,
		addKey: nextKey(read),
	};
}

function kindOf(read: Shape): Kind {
	switch (read.type) {
		case "scalar":
			return read.value === null ? "null" : (typeof read.value as "string" | "number" | "boolean");
		case "list":
			return "array";
		case "map":
			return "object";
		case "float":
			return "number";
		case "string":
			return "binary";
		default:
			return read.type;
	}
}

function summarize(read: Shape, childCount: number): string {
	switch (read.type) {
		case "scalar":
			if (typeof read.value === "string") {
				const text = read.value.length > PREVIEW_LIMIT ? `${read.value.slice(0, PREVIEW_LIMIT - 3)}...` : read.value;
				return `"${text}"`;
			}
			return typeof read.value === "number" ? formatFloat(read.value) : String(read.value);
		case "float":
			return formatFloat(read.value);
		case "string":
			return `[binary: ${encodeBase64Utf8(read.value)}]`;
		case "reference":
			return `ref(${read.index})`;
		case "custom_object":
			return `custom(${read.className})`;
		case "enum":
			return `${read.className}::${read.caseName}`;
		case "list":
		case "array":
			return `Array(${childCount})`;
		case "map":
			return `Object(${childCount})`;
		case "object":
			return read.className;
	}
}

function nodeId(path: TreePath): string {
	if (path.length === 0) return "node-root";
	const escaped = path.map((segment) =>
		segment.replace(/[^a-zA-Z0-9_-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`),
	);
	return `node-${escaped.join("--")}`;
}
