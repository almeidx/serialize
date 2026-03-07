import type { JsonValue } from "../converter/json";
import { makeUniqueArrayDataKey as makeUniqueArrayDataKeyShared } from "../converter/validation";

export type TreePath = Array<string | number>;

type JsonObject = Record<string, JsonValue>;
type PhpWrappedContainer = JsonObject & {
	__php_type__: "object" | "array";
	data?: JsonValue;
	__php_original_keys__?: JsonValue;
	__php_data_keys__?: JsonValue;
	__php_property_meta__?: JsonValue;
	__php_property_order__?: JsonValue;
};
type PhpArrayKey = { type: "int" | "string"; value: number | string };
type PhpObjectPropertyMeta = {
	name: string;
	visibility: "public" | "protected" | "private";
	className?: string;
};

function isPhpWrappedContainer(value: JsonValue): value is PhpWrappedContainer {
	if (!value || Array.isArray(value) || typeof value !== "object") return false;
	const type = (value as JsonObject).__php_type__;
	return type === "object" || type === "array";
}

function asObjectRecord(value: JsonValue | undefined): JsonObject | null {
	if (!value || Array.isArray(value) || typeof value !== "object") return null;
	return value as JsonObject;
}

function parseArrayIndex(segment: string | number): number | null {
	if (typeof segment === "number") {
		if (Number.isInteger(segment) && segment >= 0) return segment;
		return null;
	}

	if (!/^\d+$/.test(segment)) return null;
	const parsed = Number(segment);
	if (!Number.isInteger(parsed) || parsed < 0) return null;
	return parsed;
}

function toPhpArrayKey(rawKey: string): PhpArrayKey {
	if (/^-?(?:0|[1-9]\d*)$/.test(rawKey)) {
		const intValue = Number(rawKey);
		if (Number.isSafeInteger(intValue)) {
			return { type: "int", value: intValue };
		}
	}

	return { type: "string", value: rawKey };
}

type PhpArrayMetadataEntry = {
	key: PhpArrayKey;
	dataKey: string;
};

function getPhpArrayMetadataEntries(container: PhpWrappedContainer): PhpArrayMetadataEntry[] {
	if (container.__php_type__ !== "array") return [];
	if (!Array.isArray(container.__php_original_keys__)) return [];

	const originalKeys = container.__php_original_keys__.filter(
		(entry): entry is PhpArrayKey =>
			!!entry &&
			typeof entry === "object" &&
			!Array.isArray(entry) &&
			(entry as PhpArrayKey).type !== undefined &&
			((entry as PhpArrayKey).type === "int" || (entry as PhpArrayKey).type === "string"),
	);

	const explicitDataKeys =
		Array.isArray(container.__php_data_keys__) &&
		container.__php_data_keys__.length === originalKeys.length &&
		container.__php_data_keys__.every((entry) => typeof entry === "string")
			? (container.__php_data_keys__ as string[])
			: null;

	return originalKeys.map((entry, index) => ({
		key: entry,
		dataKey: explicitDataKeys?.[index] ?? String(entry.value),
	}));
}

const makeUniqueArrayDataKey = makeUniqueArrayDataKeyShared;

export function setValueAtPath(obj: JsonValue, path: TreePath, value: JsonValue): JsonValue {
	if (path.length === 0) return value;
	return setValueAtPathRecursive(obj, path, value);
}

export function deleteAtPath(obj: JsonValue, path: TreePath): JsonValue {
	if (path.length === 0) return obj;
	return deleteAtPathRecursive(obj, path);
}

export function addAtPath(obj: JsonValue, path: TreePath, key: string, value: JsonValue): JsonValue {
	return addAtPathRecursive(obj, path, key, value);
}

function setValueAtPathRecursive(obj: JsonValue, path: TreePath, value: JsonValue): JsonValue {
	const [segment, ...rest] = path;

	if (Array.isArray(obj)) {
		const index = parseArrayIndex(segment);
		if (index === null) return obj;

		if (rest.length === 0) {
			const copy = obj.slice();
			copy[index] = value;
			return copy;
		}

		const child = obj[index];
		if (child === undefined) return obj;

		const updatedChild = setValueAtPathRecursive(child, rest, value);
		if (updatedChild === child) return obj;

		const copy = obj.slice();
		copy[index] = updatedChild;
		return copy;
	}

	const object = asObjectRecord(obj);
	if (!object) return obj;

	const key = String(segment);
	if (isPhpWrappedContainer(object)) {
		const data = asObjectRecord(object.data);
		if (!data) return obj;

		if (rest.length === 0) {
			return {
				...object,
				data: {
					...data,
					[key]: value,
				},
			};
		}

		const child = data[key];
		if (child === undefined) return obj;

		const updatedChild = setValueAtPathRecursive(child, rest, value);
		if (updatedChild === child) return obj;

		return {
			...object,
			data: {
				...data,
				[key]: updatedChild,
			},
		};
	}

	if (rest.length === 0) {
		return {
			...object,
			[key]: value,
		};
	}

	const child = object[key];
	if (child === undefined) return obj;

	const updatedChild = setValueAtPathRecursive(child, rest, value);
	if (updatedChild === child) return obj;

	return {
		...object,
		[key]: updatedChild,
	};
}

function deleteAtPathRecursive(obj: JsonValue, path: TreePath): JsonValue {
	const [segment, ...rest] = path;

	if (Array.isArray(obj)) {
		const index = parseArrayIndex(segment);
		if (index === null) return obj;

		if (rest.length === 0) {
			if (index < 0 || index >= obj.length) return obj;
			const copy = obj.slice();
			copy.splice(index, 1);
			return copy;
		}

		const child = obj[index];
		if (child === undefined) return obj;

		const updatedChild = deleteAtPathRecursive(child, rest);
		if (updatedChild === child) return obj;

		const copy = obj.slice();
		copy[index] = updatedChild;
		return copy;
	}

	const object = asObjectRecord(obj);
	if (!object) return obj;

	const key = String(segment);
	if (isPhpWrappedContainer(object)) {
		const data = asObjectRecord(object.data);
		if (!data) return obj;

		if (rest.length === 0) {
			const hasDataKey = Object.prototype.hasOwnProperty.call(data, key);
			const removedArrayMeta = withoutPhpArrayKeyMetadata(object, key);
			const removedObjectMeta = withoutPhpObjectPropertyMetadata(object, key);
			if (!hasDataKey && !removedArrayMeta && !removedObjectMeta) return obj;

			const nextData = { ...data };
			if (hasDataKey) {
				delete nextData[key];
			}

			const updated: PhpWrappedContainer = {
				...object,
				data: nextData,
			};
			if (removedArrayMeta) {
				updated.__php_original_keys__ = removedArrayMeta.originalKeys;
				updated.__php_data_keys__ = removedArrayMeta.dataKeys;
			}
			if (removedObjectMeta) {
				updated.__php_property_meta__ = removedObjectMeta.meta;
				updated.__php_property_order__ = removedObjectMeta.order;
			}
			return updated;
		}

		const child = data[key];
		if (child === undefined) return obj;

		const updatedChild = deleteAtPathRecursive(child, rest);
		if (updatedChild === child) return obj;

		return {
			...object,
			data: {
				...data,
				[key]: updatedChild,
			},
		};
	}

	if (rest.length === 0) {
		if (!Object.prototype.hasOwnProperty.call(object, key)) return obj;
		const copy = { ...object };
		delete copy[key];
		return copy;
	}

	const child = object[key];
	if (child === undefined) return obj;

	const updatedChild = deleteAtPathRecursive(child, rest);
	if (updatedChild === child) return obj;

	return {
		...object,
		[key]: updatedChild,
	};
}

function addAtPathRecursive(obj: JsonValue, path: TreePath, key: string, value: JsonValue): JsonValue {
	if (path.length === 0) {
		return addToContainer(obj, key, value);
	}

	const [segment, ...rest] = path;
	if (Array.isArray(obj)) {
		const index = parseArrayIndex(segment);
		if (index === null) return obj;

		const child = obj[index];
		if (child === undefined) return obj;

		const updatedChild = addAtPathRecursive(child, rest, key, value);
		if (updatedChild === child) return obj;

		const copy = obj.slice();
		copy[index] = updatedChild;
		return copy;
	}

	const object = asObjectRecord(obj);
	if (!object) return obj;

	const containerKey = String(segment);
	if (isPhpWrappedContainer(object)) {
		const data = asObjectRecord(object.data);
		if (!data) return obj;

		const child = data[containerKey];
		if (child === undefined) return obj;

		const updatedChild = addAtPathRecursive(child, rest, key, value);
		if (updatedChild === child) return obj;

		return {
			...object,
			data: {
				...data,
				[containerKey]: updatedChild,
			},
		};
	}

	const child = object[containerKey];
	if (child === undefined) return obj;

	const updatedChild = addAtPathRecursive(child, rest, key, value);
	if (updatedChild === child) return obj;

	return {
		...object,
		[containerKey]: updatedChild,
	};
}

function addToContainer(target: JsonValue, key: string, value: JsonValue): JsonValue {
	if (Array.isArray(target)) {
		const index = parseArrayIndex(key);
		if (index === null) return target;

		const copy = target.slice();
		if (index >= copy.length) {
			copy.push(value);
		} else {
			copy.splice(index, 0, value);
		}
		return copy;
	}

	const object = asObjectRecord(target);
	if (!object) return target;

	if (isPhpWrappedContainer(object)) {
		const data = asObjectRecord(object.data);
		if (!data) return target;

		const addedArrayMeta = withAddedPhpArrayKeyMetadata(object, key);
		const dataKey = addedArrayMeta?.dataKey ?? key;

		const updated: PhpWrappedContainer = {
			...object,
			data: {
				...data,
				[dataKey]: value,
			},
		};

		if (addedArrayMeta?.patch) {
			updated.__php_original_keys__ = addedArrayMeta.patch.originalKeys;
			updated.__php_data_keys__ = addedArrayMeta.patch.dataKeys;
		}
		const addedObjectMeta = withAddedPhpObjectPropertyMetadata(updated, key);
		if (addedObjectMeta) {
			updated.__php_property_meta__ = addedObjectMeta.meta;
			updated.__php_property_order__ = addedObjectMeta.order;
		}
		return updated;
	}

	return {
		...object,
		[key]: value,
	};
}

type PhpArrayMetadataPatch = {
	originalKeys: PhpArrayKey[];
	dataKeys?: string[];
};

type PhpArrayMetadataAddResult = {
	dataKey: string;
	patch: PhpArrayMetadataPatch | null;
};

function withAddedPhpArrayKeyMetadata(
	container: PhpWrappedContainer,
	rawKey: string,
): PhpArrayMetadataAddResult | null {
	if (container.__php_type__ !== "array") return null;

	const keyInfo = toPhpArrayKey(rawKey);
	const entries = getPhpArrayMetadataEntries(container);

	const existing = entries.find(
		(entry) => entry.key.type === keyInfo.type && String(entry.key.value) === String(keyInfo.value),
	);
	if (existing) {
		return { dataKey: existing.dataKey, patch: null };
	}

	const usedDataKeys = new Set(entries.map((entry) => entry.dataKey));
	const dataKey = makeUniqueArrayDataKey(rawKey, usedDataKeys);
	const nextEntries = [...entries, { key: keyInfo, dataKey }];
	const nextOriginalKeys = nextEntries.map((entry) => entry.key);
	const nextDataKeys = nextEntries.map((entry) => entry.dataKey);

	const needsDataKeys = nextDataKeys.some((entry, index) => entry !== String(nextOriginalKeys[index].value));

	return {
		dataKey,
		patch: {
			originalKeys: nextOriginalKeys,
			dataKeys: needsDataKeys ? nextDataKeys : undefined,
		},
	};
}

function withoutPhpArrayKeyMetadata(container: PhpWrappedContainer, rawDataKey: string): PhpArrayMetadataPatch | null {
	if (container.__php_type__ !== "array") return null;

	const entries = getPhpArrayMetadataEntries(container);
	if (entries.length === 0) return null;

	let nextEntries: PhpArrayMetadataEntry[];

	const byDataKeyIndex = entries.findIndex((entry) => entry.dataKey === rawDataKey);
	if (byDataKeyIndex !== -1) {
		nextEntries = entries.filter((_, index) => index !== byDataKeyIndex);
	} else {
		const legacyMatchIndices = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => String(entry.key.value) === rawDataKey)
			.map(({ index }) => index);

		if (legacyMatchIndices.length === 0) return null;
		nextEntries = entries.filter((_, index) => !legacyMatchIndices.includes(index));
	}

	const nextOriginalKeys = nextEntries.map((entry) => entry.key);
	const nextDataKeys = nextEntries.map((entry) => entry.dataKey);
	const needsDataKeys = nextDataKeys.some((entry, index) => entry !== String(nextOriginalKeys[index].value));

	return {
		originalKeys: nextOriginalKeys,
		dataKeys: needsDataKeys ? nextDataKeys : undefined,
	};
}

function withAddedPhpObjectPropertyMetadata(
	container: PhpWrappedContainer,
	rawKey: string,
): { meta: JsonObject; order: string[] } | null {
	if (container.__php_type__ !== "object") return null;

	const existingMeta = asObjectRecord(container.__php_property_meta__) ?? {};
	const existingOrder = Array.isArray(container.__php_property_order__)
		? container.__php_property_order__.filter((entry): entry is string => typeof entry === "string")
		: [];

	const hasMeta = Object.prototype.hasOwnProperty.call(existingMeta, rawKey);
	const hasOrder = existingOrder.includes(rawKey);
	if (hasMeta && hasOrder) return null;

	const nextMeta: JsonObject = hasMeta
		? { ...existingMeta }
		: {
				...existingMeta,
				[rawKey]: {
					name: rawKey,
					visibility: "public",
				} as PhpObjectPropertyMeta as JsonValue,
			};
	const nextOrder = hasOrder ? existingOrder.slice() : [...existingOrder, rawKey];

	return { meta: nextMeta, order: nextOrder };
}

function withoutPhpObjectPropertyMetadata(
	container: PhpWrappedContainer,
	rawKey: string,
): { meta: JsonObject; order: string[] } | null {
	if (container.__php_type__ !== "object") return null;

	const existingMeta = asObjectRecord(container.__php_property_meta__) ?? {};
	const existingOrder = Array.isArray(container.__php_property_order__)
		? container.__php_property_order__.filter((entry): entry is string => typeof entry === "string")
		: [];

	let changed = false;
	const nextMeta: JsonObject = { ...existingMeta };
	if (Object.prototype.hasOwnProperty.call(nextMeta, rawKey)) {
		delete nextMeta[rawKey];
		changed = true;
	}

	const nextOrder = existingOrder.filter((entry) => entry !== rawKey);
	if (nextOrder.length !== existingOrder.length) {
		changed = true;
	}

	return changed ? { meta: nextMeta, order: nextOrder } : null;
}
