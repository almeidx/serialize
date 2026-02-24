import type { JsonValue } from '../converter/json';

export type TreePath = Array<string | number>;

type JsonObject = Record<string, JsonValue>;
type JsonContainer = JsonObject | JsonValue[];
type PhpWrappedContainer = JsonObject & {
	__php_type__: 'object' | 'array';
	data?: JsonValue;
	__php_original_keys__?: unknown;
};
type PhpArrayKey = { type: 'int' | 'string'; value: number | string };

function isPhpWrappedContainer(value: JsonValue): value is PhpWrappedContainer {
	if (!value || Array.isArray(value) || typeof value !== 'object') return false;
	const type = (value as JsonObject).__php_type__;
	return type === 'object' || type === 'array';
}

function asObjectRecord(value: JsonValue | undefined): JsonObject | null {
	if (!value || Array.isArray(value) || typeof value !== 'object') return null;
	return value as JsonObject;
}

function cloneJson(value: JsonValue): JsonValue {
	return structuredClone(value);
}

function parseArrayIndex(segment: string | number): number | null {
	if (typeof segment === 'number') {
		if (Number.isInteger(segment) && segment >= 0) return segment;
		return null;
	}

	if (!/^\d+$/.test(segment)) return null;
	const parsed = Number(segment);
	if (!Number.isInteger(parsed) || parsed < 0) return null;
	return parsed;
}

function getChild(container: JsonContainer, segment: string | number): JsonValue | undefined {
	if (Array.isArray(container)) {
		const index = parseArrayIndex(segment);
		if (index === null) return undefined;
		return container[index];
	}

	if (isPhpWrappedContainer(container)) {
		const data = asObjectRecord(container.data);
		if (!data) return undefined;
		return data[String(segment)];
	}

	return container[String(segment)];
}

function getContainerAtPath(root: JsonValue, path: TreePath): JsonContainer | null {
	if (path.length === 0) return asObjectRecord(root) ?? (Array.isArray(root) ? root : null);

	let current: JsonValue = root;
	for (const segment of path) {
		const container = asObjectRecord(current) ?? (Array.isArray(current) ? current : null);
		if (!container) return null;

		const next = getChild(container, segment);
		if (next === undefined) return null;
		current = next;
	}

	return asObjectRecord(current) ?? (Array.isArray(current) ? current : null);
}

function upsertPhpArrayKeyMetadata(container: PhpWrappedContainer, rawKey: string): void {
	if (container.__php_type__ !== 'array') return;

	const keyInfo = toPhpArrayKey(rawKey);
	const existing = Array.isArray(container.__php_original_keys__)
		? (container.__php_original_keys__ as PhpArrayKey[])
		: [];

	const hasKey = existing.some(
		(item) => item.type === keyInfo.type && String(item.value) === String(keyInfo.value)
	);

	if (!hasKey) {
		existing.push(keyInfo);
		container.__php_original_keys__ = existing;
	}
}

function removePhpArrayKeyMetadata(container: PhpWrappedContainer, rawKey: string): void {
	if (container.__php_type__ !== 'array') return;

	const keys = container.__php_original_keys__;
	if (!Array.isArray(keys)) return;

	const idx = (keys as PhpArrayKey[]).findIndex((entry) => String(entry.value) === rawKey);
	if (idx !== -1) {
		(keys as PhpArrayKey[]).splice(idx, 1);
	}
}

function toPhpArrayKey(rawKey: string): PhpArrayKey {
	if (/^-?(?:0|[1-9]\d*)$/.test(rawKey)) {
		const intValue = Number(rawKey);
		if (Number.isSafeInteger(intValue)) {
			return { type: 'int', value: intValue };
		}
	}

	return { type: 'string', value: rawKey };
}

export function setValueAtPath(obj: JsonValue, path: TreePath, value: JsonValue): JsonValue {
	if (path.length === 0) return value;

	const clone = cloneJson(obj);
	const parent = getContainerAtPath(clone, path.slice(0, -1));
	if (!parent) return clone;

	const last = path[path.length - 1];
	if (Array.isArray(parent)) {
		const index = parseArrayIndex(last);
		if (index === null) return clone;
		parent[index] = value;
		return clone;
	}

	if (isPhpWrappedContainer(parent)) {
		const data = asObjectRecord(parent.data);
		if (!data) return clone;
		data[String(last)] = value;
		return clone;
	}

	parent[String(last)] = value;
	return clone;
}

export function deleteAtPath(obj: JsonValue, path: TreePath): JsonValue {
	if (path.length === 0) return obj;

	const clone = cloneJson(obj);
	const parent = getContainerAtPath(clone, path.slice(0, -1));
	if (!parent) return clone;

	const last = path[path.length - 1];
	if (Array.isArray(parent)) {
		const index = parseArrayIndex(last);
		if (index === null) return clone;
		parent.splice(index, 1);
		return clone;
	}

	if (isPhpWrappedContainer(parent)) {
		const data = asObjectRecord(parent.data);
		if (!data) return clone;
		const key = String(last);
		delete data[key];
		removePhpArrayKeyMetadata(parent, key);
		return clone;
	}

	delete parent[String(last)];
	return clone;
}

export function addAtPath(obj: JsonValue, path: TreePath, key: string, value: JsonValue): JsonValue {
	const clone = cloneJson(obj);
	const target = path.length === 0 ? (asObjectRecord(clone) ?? (Array.isArray(clone) ? clone : null)) : getContainerAtPath(clone, path);
	if (!target) return clone;

	if (Array.isArray(target)) {
		const index = parseArrayIndex(key);
		if (index === null) return clone;
		if (index >= target.length) {
			target.push(value);
		} else {
			target.splice(index, 0, value);
		}
		return clone;
	}

	if (isPhpWrappedContainer(target)) {
		const data = asObjectRecord(target.data);
		if (!data) return clone;
		data[key] = value;
		upsertPhpArrayKeyMetadata(target, key);
		return clone;
	}

	target[key] = value;
	return clone;
}
