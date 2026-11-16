import type { JsonObject, JsonValue } from "../converter/types";
import { phpArrayEntries, type TreePath } from "./operations";

/** What a node shows as, after unwrapping the PHP metadata wrappers from `converter/json.ts`. */
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

export interface TreeNode {
	/** Stable across edits for the same path, so expansion survives updates. */
	id: string;
	path: TreePath;
	/** Displayed key; `null` for the root value. */
	key: string | number | null;
	value: JsonValue;
	kind: Kind;
	children: TreeNode[];
}

const PREVIEW_LIMIT = 100;

function asObject(value: JsonValue): JsonObject | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function kindOf(value: JsonValue): Kind {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "object") {
		switch (value.__php_type__) {
			case "float":
				return "number";
			case "array":
				return "array";
			case "string":
				return "binary";
			case "reference":
				return "reference";
			case "custom_object":
				return "custom_object";
			case "enum":
				return "enum";
			default:
				return "object";
		}
	}
	return typeof value as "string" | "number" | "boolean";
}

export function isContainer(kind: Kind): boolean {
	return kind === "array" || kind === "object";
}

/** `[pathKey, displayKey, value]` for each child, in PHP order. */
function childEntries(value: JsonValue): Array<[string | number, string | number, JsonValue]> {
	if (Array.isArray(value)) return value.map((child, index) => [index, index, child]);

	const object = asObject(value);
	if (!object) return [];

	const type = object.__php_type__;
	if (type === "array" || type === "object") {
		const data = asObject(object.data ?? null);
		if (!data) return [];
		const entries = type === "array" ? phpArrayEntries(object) : [];
		if (entries.length === 0) return Object.entries(data).map(([key, child]) => [key, key, child]);
		return entries
			.filter(({ dataKey }) => data[dataKey] !== undefined)
			.map(({ key, dataKey }) => [dataKey, key.value, data[dataKey]]);
	}
	if (type !== undefined) return [];

	return Object.entries(object)
		.filter(([key]) => !key.startsWith("__php_"))
		.map(([key, child]) => [key, key, child]);
}

function nodeId(path: TreePath): string {
	if (path.length === 0) return "node-root";
	const escaped = path.map((segment) =>
		String(segment).replace(/[^a-zA-Z0-9_-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`),
	);
	return `node-${escaped.join("--")}`;
}

function buildNode(value: JsonValue, path: TreePath, key: string | number | null): TreeNode {
	const kind = kindOf(value);
	return {
		id: nodeId(path),
		path,
		key,
		value,
		kind,
		children: isContainer(kind)
			? childEntries(value).map(([pathKey, displayKey, child]) => buildNode(child, [...path, pathKey], displayKey))
			: [],
	};
}

/** A synthetic root holding the document as its only child, so the top-level value gets a row too. */
export function buildTree(data: JsonValue): TreeNode {
	return { id: "tree", path: [], key: null, value: null, kind: "null", children: [buildNode(data, [], null)] };
}

/** Ids expanded on first render: the document and its direct children. */
export function defaultExpanded(root: TreeNode): string[] {
	const document = root.children[0];
	if (!document) return [];
	return [document, ...document.children].filter((node) => node.children.length > 0).map((node) => node.id);
}

/** Wrapper fields as text: strings verbatim, anything else as JSON. */
function plain(value: JsonValue | undefined): string {
	return typeof value === "string" ? value : (JSON.stringify(value) ?? "");
}

/** Inline text for a row: the value for scalars, a short summary for containers. */
export function describe(node: TreeNode): string {
	const { value, kind } = node;
	const object = asObject(value);
	switch (kind) {
		case "string": {
			const text = value as string;
			return `"${text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT - 3)}...` : text}"`;
		}
		case "number":
			return plain(object ? object.value : value);
		case "boolean":
		case "null":
			return plain(value);
		case "binary":
			return `[binary: ${plain(object?.value)}]`;
		case "reference":
			return `ref(${plain(object?.__php_ref_index__)})`;
		case "custom_object":
			return `custom(${plain(object?.__php_class__)})`;
		case "enum":
			return `${plain(object?.__php_class__)}::${plain(object?.__php_enum_case__)}`;
		case "array":
			return `Array(${node.children.length})`;
		case "object":
			return typeof object?.__php_class__ === "string" ? object.__php_class__ : `Object(${node.children.length})`;
	}
}

/** Text placed in the inline editor; `undefined` when the kind is not editable in place. */
export function editText(node: TreeNode): string | undefined {
	switch (node.kind) {
		case "string":
			return node.value as string;
		case "number": {
			const object = asObject(node.value);
			return plain(object ? object.value : node.value);
		}
		case "boolean":
		case "null":
			return JSON.stringify(node.value);
		default:
			return undefined;
	}
}

/** Value typed into the inline editor; `undefined` when it is not valid JSON for a non-string node. */
export function parseEdit(node: TreeNode, text: string): JsonValue | undefined {
	if (node.kind === "string") return text;
	try {
		return JSON.parse(text) as JsonValue;
	} catch {
		return undefined;
	}
}

export function convert(node: TreeNode, to: EditableKind): JsonValue {
	switch (to) {
		case "string":
			return node.kind === "number" ? describe(node) : "";
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
