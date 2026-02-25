import type { JsonValue } from '../converter/json';

export type TreePath = Array<string | number>;

type JsonObject = Record<string, JsonValue>;
type PhpWrappedContainer = JsonObject & {
	__php_type__: 'object' | 'array';
	data?: JsonValue;
	__php_original_keys__?: JsonValue;
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
					[key]: value
				}
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
				[key]: updatedChild
			}
		};
	}

	if (rest.length === 0) {
		return {
			...object,
			[key]: value
		};
	}

	const child = object[key];
	if (child === undefined) return obj;

	const updatedChild = setValueAtPathRecursive(child, rest, value);
	if (updatedChild === child) return obj;

	return {
		...object,
		[key]: updatedChild
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
			const removedKeys = withoutPhpArrayKeyMetadata(object, key);
			if (!hasDataKey && !removedKeys) return obj;

			const nextData = { ...data };
			if (hasDataKey) {
				delete nextData[key];
			}

			const updated: PhpWrappedContainer = {
				...object,
				data: nextData
			};
			if (removedKeys) {
				updated.__php_original_keys__ = removedKeys;
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
				[key]: updatedChild
			}
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
		[key]: updatedChild
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
				[containerKey]: updatedChild
			}
		};
	}

	const child = object[containerKey];
	if (child === undefined) return obj;

	const updatedChild = addAtPathRecursive(child, rest, key, value);
	if (updatedChild === child) return obj;

	return {
		...object,
		[containerKey]: updatedChild
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

		const updated: PhpWrappedContainer = {
			...object,
			data: {
				...data,
				[key]: value
			}
		};

		const addedKeys = withAddedPhpArrayKeyMetadata(updated, key);
		if (addedKeys) {
			updated.__php_original_keys__ = addedKeys;
		}
		return updated;
	}

	return {
		...object,
		[key]: value
	};
}

function withAddedPhpArrayKeyMetadata(
	container: PhpWrappedContainer,
	rawKey: string
): PhpArrayKey[] | null {
	if (container.__php_type__ !== 'array') return null;

	const keyInfo = toPhpArrayKey(rawKey);
	const existing = Array.isArray(container.__php_original_keys__)
		? (container.__php_original_keys__ as PhpArrayKey[])
		: [];

	const hasKey = existing.some(
		(item) => item.type === keyInfo.type && String(item.value) === String(keyInfo.value)
	);

	if (hasKey) return null;
	return [...existing, keyInfo];
}

function withoutPhpArrayKeyMetadata(
	container: PhpWrappedContainer,
	rawKey: string
): PhpArrayKey[] | null {
	if (container.__php_type__ !== 'array') return null;
	if (!Array.isArray(container.__php_original_keys__)) return null;

	const existing = container.__php_original_keys__ as PhpArrayKey[];
	const next = existing.filter((entry) => String(entry.value) !== rawKey);
	return next.length === existing.length ? null : next;
}
