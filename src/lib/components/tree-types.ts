import type { JsonValue } from "#lib/converter/index.js";
import type { TreePath } from "#lib/tree/operations.js";

export type TreeOperation =
	| { type: "set"; path: TreePath; value: JsonValue }
	| { type: "delete"; path: TreePath }
	| { type: "add"; path: TreePath; key: string; value: JsonValue };
