import type { JsonValue } from "#lib/converter/types.js";
import { addChild, children, removeChild, setChild, shape } from "./shape.js";

/** `Child.key`s from the document root. */
export type TreePath = string[];

/** Every tree edit, applied through `applyOperation` so the tree and JSON views share one update path. */
export type TreeOperation =
	| { type: "set"; path: TreePath; value: JsonValue }
	| { type: "delete"; path: TreePath }
	| { type: "add"; path: TreePath; key: string; value: JsonValue };

/** Returns `data` unchanged when the operation does not apply, e.g. its path no longer exists. */
export function applyOperation(data: JsonValue, op: TreeOperation): JsonValue {
	if (op.type === "add") return update(data, op.path, (container) => addChild(shape(container), op.key, op.value));
	if (op.path.length === 0) return op.type === "set" ? op.value : data;

	const key = op.path.at(-1)!;
	return update(data, op.path.slice(0, -1), (container) =>
		op.type === "set" ? setChild(shape(container), key, op.value) : removeChild(shape(container), key),
	);
}

function update(value: JsonValue, path: TreePath, change: (value: JsonValue) => JsonValue | undefined): JsonValue {
	if (path.length === 0) return change(value) ?? value;

	const [key, ...rest] = path;
	const container = shape(value);
	const child = children(container).find((candidate) => candidate.key === key);
	if (!child) return value;

	const updated = update(child.value, rest, change);
	return updated === child.value ? value : (setChild(container, key, updated) ?? value);
}
