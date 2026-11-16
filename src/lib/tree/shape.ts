import { isJsonObject, type JsonObject, type JsonValue } from "#lib/converter/types.js";
import { dataKeyAllocator, decodeWrapper, encodeWrapper, isWrapper, type Wrapper } from "#lib/converter/wrappers.js";
import { toArrayKey } from "#lib/parser/types.js";

/** A JSON value as the tree reads it: plain JSON as is, wrappers decoded. */
export type Shape =
	| { type: "scalar"; value: string | number | boolean | null }
	| { type: "list"; items: JsonValue[] }
	| { type: "map"; object: JsonObject }
	| Wrapper;

/** `key` addresses a child in a tree path; `label` is what its row shows. */
export interface Child {
	key: string;
	label: string | number;
	value: JsonValue;
}

/** A malformed wrapper reads as the plain object it is, so it can still be edited into shape. */
export function shape(value: JsonValue): Shape {
	if (Array.isArray(value)) return { type: "list", items: value };
	if (!isJsonObject(value)) return { type: "scalar", value };
	if (isWrapper(value)) {
		try {
			return decodeWrapper(value);
		} catch {
			// `fromJson` reports the problem; the tree shows the raw fields.
		}
	}
	return { type: "map", object: value };
}

export function children(container: Shape): Child[] {
	switch (container.type) {
		case "list":
			return container.items.map((value, index) => ({ key: String(index), label: index, value }));
		case "map":
			return Object.entries(container.object).map(([key, value]) => ({ key, label: key, value }));
		case "array":
			return container.entries.map(({ key, dataKey, value }) => ({ key: dataKey, label: key.value, value }));
		case "object":
			return container.properties.map(({ dataKey, value }) => ({ key: dataKey, label: dataKey, value }));
		default:
			return [];
	}
}

/** Replaces an existing child; `undefined` when there is none at `key`. */
export function setChild(container: Shape, key: string, value: JsonValue): JsonValue | undefined {
	switch (container.type) {
		case "list": {
			const index = listIndex(key);
			return index !== undefined && index < container.items.length ? container.items.with(index, value) : undefined;
		}
		case "map":
			return Object.hasOwn(container.object, key) ? { ...container.object, [key]: value } : undefined;
		case "array": {
			const index = container.entries.findIndex((entry) => entry.dataKey === key);
			if (index === -1) return undefined;
			return encodeWrapper({
				...container,
				entries: container.entries.with(index, { ...container.entries[index], value }),
			});
		}
		case "object": {
			const index = container.properties.findIndex((property) => property.dataKey === key);
			if (index === -1) return undefined;
			return encodeWrapper({
				...container,
				properties: container.properties.with(index, { ...container.properties[index], value }),
			});
		}
		default:
			return undefined;
	}
}

/** Removes an existing child; `undefined` when there is none at `key`. */
export function removeChild(container: Shape, key: string): JsonValue | undefined {
	switch (container.type) {
		case "list": {
			const index = listIndex(key);
			return index !== undefined && index < container.items.length ? container.items.toSpliced(index, 1) : undefined;
		}
		case "map":
			if (!Object.hasOwn(container.object, key)) return undefined;
			return Object.fromEntries(Object.entries(container.object).filter(([entryKey]) => entryKey !== key));
		case "array": {
			const entries = container.entries.filter((entry) => entry.dataKey !== key);
			return entries.length === container.entries.length ? undefined : encodeWrapper({ ...container, entries });
		}
		case "object": {
			const properties = container.properties.filter((property) => property.dataKey !== key);
			return properties.length === container.properties.length
				? undefined
				: encodeWrapper({ ...container, properties });
		}
		default:
			return undefined;
	}
}

/**
 * Adds a child under the key a user typed; lists insert at the index, appending past the end.
 * `undefined` when the key is taken or does not fit the container.
 */
export function addChild(container: Shape, key: string, value: JsonValue): JsonValue | undefined {
	switch (container.type) {
		case "list": {
			const index = listIndex(key);
			return index === undefined
				? undefined
				: container.items.toSpliced(Math.min(index, container.items.length), 0, value);
		}
		case "map":
			return Object.hasOwn(container.object, key) ? undefined : { ...container.object, [key]: value };
		case "array": {
			const arrayKey = toArrayKey(key);
			if (container.entries.some((entry) => entry.key.type === arrayKey.type && entry.key.value === arrayKey.value)) {
				return undefined;
			}
			const dataKey = dataKeyAllocator(container.entries.map((entry) => entry.dataKey))(key);
			return encodeWrapper({ ...container, entries: [...container.entries, { key: arrayKey, dataKey, value }] });
		}
		case "object": {
			if (container.properties.some((property) => property.visibility === "public" && property.name === key)) {
				return undefined;
			}
			const dataKey = dataKeyAllocator(container.properties.map((property) => property.dataKey))(key);
			return encodeWrapper({
				...container,
				properties: [...container.properties, { dataKey, name: key, visibility: "public", value }],
			});
		}
		default:
			return undefined;
	}
}

/** The key an add starts from: PHP's next index for arrays, empty for objects; `undefined` for non-containers. */
export function nextKey(container: Shape): string | undefined {
	switch (container.type) {
		case "list":
			return String(container.items.length);
		case "array":
			return String(
				container.entries.reduce((next, { key }) => (key.type === "int" ? Math.max(next, key.value + 1) : next), 0),
			);
		case "map":
		case "object":
			return "";
		default:
			return undefined;
	}
}

function listIndex(key: string): number | undefined {
	return /^\d+$/.test(key) ? Number(key) : undefined;
}
