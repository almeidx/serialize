import type { PhpValue, PhpArrayEntry, PhpObjectProperty } from '../parser/types';

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface JsonWithMeta {
	__php_type__: string;
	__php_class__?: string;
	__php_visibility__?: Record<string, 'public' | 'protected' | 'private'>;
	__php_property_class__?: Record<string, string>;
	__php_binary__?: boolean;
	__php_ref_index__?: number;
	__php_ref_object__?: boolean;
	__php_original_keys__?: Array<{ type: 'int' | 'string'; value: number | string }>;
	data?: JsonValue;
	value?: JsonValue;
}

type JsonObject = Record<string, JsonValue>;
type PhpVisibility = 'public' | 'protected' | 'private';

export function toJson(php: PhpValue): JsonValue {
	switch (php.type) {
		case 'null':
			return null;

		case 'bool':
			return php.value;

		case 'int':
		case 'float':
			return php.value;

		case 'string':
			if (php.binary) {
				return {
					__php_type__: 'string',
					__php_binary__: true,
					value: btoa(php.value)
				};
			}
			return php.value;

		case 'array': {
			const isSequential = isSequentialArray(php.entries);

			if (isSequential) {
				return php.entries.map((e) => toJson(e.value));
			}

			const result: Record<string, JsonValue> = {
				__php_type__: 'array',
				__php_original_keys__: php.entries.map((e) => ({
					type: e.key.type as 'int' | 'string',
					value: e.key.type === 'int' ? e.key.value : e.key.value
				}))
			};

			const data: Record<string, JsonValue> = {};
			for (const entry of php.entries) {
				const key = entry.key.type === 'int' ? String(entry.key.value) : entry.key.value;
				data[key] = toJson(entry.value);
			}
			result.data = data;

			return result;
		}

		case 'object': {
			const result: Record<string, JsonValue> = {
				__php_type__: 'object',
				__php_class__: php.className
			};

			const visibilities: Record<string, 'public' | 'protected' | 'private'> = {};
			const propertyClasses: Record<string, string> = {};
			const data: Record<string, JsonValue> = {};

			for (const prop of php.properties) {
				data[prop.name] = toJson(prop.value);

				if (prop.visibility !== 'public') {
					visibilities[prop.name] = prop.visibility;
				}
				if (prop.className) {
					propertyClasses[prop.name] = prop.className;
				}
			}

			if (Object.keys(visibilities).length > 0) {
				result.__php_visibility__ = visibilities;
			}
			if (Object.keys(propertyClasses).length > 0) {
				result.__php_property_class__ = propertyClasses;
			}

			result.data = data;
			return result;
		}

		case 'reference':
			return {
				__php_type__: 'reference',
				__php_ref_index__: php.index,
				__php_ref_object__: php.isObject
			};
	}
}

export function fromJson(json: JsonValue): PhpValue {
	if (json === null) {
		return { type: 'null' };
	}

	if (typeof json === 'boolean') {
		return { type: 'bool', value: json };
	}

	if (typeof json === 'number') {
		if (Number.isInteger(json)) {
			return { type: 'int', value: json };
		}
		return { type: 'float', value: json };
	}

	if (typeof json === 'string') {
		return { type: 'string', value: json };
	}

	if (Array.isArray(json)) {
		const entries: PhpArrayEntry[] = json.map((item, index) => ({
			key: { type: 'int' as const, value: index },
			value: fromJson(item)
		}));
		return { type: 'array', entries };
	}

	if (typeof json === 'object') {
		const obj = json as JsonObject;
		const typeTag = obj.__php_type__;

		if (typeTag !== undefined) {
			if (typeof typeTag !== 'string') {
				throw new Error('__php_type__ must be a string when present');
			}

			switch (typeTag) {
				case 'string':
					return fromBinaryWrapper(obj);
				case 'reference':
					return fromReferenceWrapper(obj);
				case 'array':
					return fromArrayWrapper(obj);
				case 'object':
					return fromObjectWrapper(obj);
				default:
					throw new Error(`Unsupported __php_type__ value '${typeTag}'`);
			}
		}

		const entries: PhpArrayEntry[] = Object.entries(obj).map(([key, value]) => ({
			key: { type: 'string' as const, value: key },
			value: fromJson(value)
		}));
		return { type: 'array', entries };
	}

	return { type: 'null' };
}

function isSequentialArray(entries: PhpArrayEntry[]): boolean {
	return entries.every(
		(entry, index) => entry.key.type === 'int' && entry.key.value === index
	);
}

function fromBinaryWrapper(obj: JsonObject): PhpValue {
	if (obj.__php_binary__ !== true) {
		throw new Error("Binary string wrapper must include '__php_binary__': true");
	}
	if (typeof obj.value !== 'string') {
		throw new Error("Binary string wrapper requires a base64 'value' string");
	}

	let decoded: string;
	try {
		decoded = atob(obj.value);
	} catch {
		throw new Error('Binary string wrapper contains invalid base64 data');
	}

	return {
		type: 'string',
		value: decoded,
		binary: true
	};
}

function fromReferenceWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_ref_index__ !== 'number' || !Number.isInteger(obj.__php_ref_index__)) {
		throw new Error('Reference wrapper requires integer __php_ref_index__');
	}
	if (obj.__php_ref_index__ < 1) {
		throw new Error('Reference wrapper __php_ref_index__ must be >= 1');
	}
	if (typeof obj.__php_ref_object__ !== 'boolean') {
		throw new Error('Reference wrapper requires boolean __php_ref_object__');
	}

	return {
		type: 'reference',
		index: obj.__php_ref_index__,
		isObject: obj.__php_ref_object__
	};
}

function fromArrayWrapper(obj: JsonObject): PhpValue {
	const data = requireObject(obj.data, "Array wrapper 'data'");
	if (!Array.isArray(obj.__php_original_keys__)) {
		throw new Error("Array wrapper requires '__php_original_keys__' array");
	}

	const originalKeys: Array<{ type: 'int' | 'string'; value: number | string }> =
		obj.__php_original_keys__.map((entry, index) => parseArrayKeyMetadataEntry(entry, index));

	const seen = new Set<string>();
	const entries: PhpArrayEntry[] = originalKeys.map((keyInfo) => {
		const keyStr = String(keyInfo.value);
		const dedupeKey = `${keyInfo.type}:${keyStr}`;
		if (seen.has(dedupeKey)) {
			throw new Error(`Array wrapper has duplicate key metadata for '${keyStr}'`);
		}
		seen.add(dedupeKey);

		if (!(keyStr in data)) {
			throw new Error(`Array wrapper key '${keyStr}' is missing from data`);
		}

		return {
			key:
				keyInfo.type === 'int'
					? { type: 'int' as const, value: keyInfo.value as number }
					: { type: 'string' as const, value: keyInfo.value as string },
			value: fromJson(data[keyStr])
		};
	});

	return { type: 'array', entries };
}

function fromObjectWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_class__ !== 'string' || obj.__php_class__.length === 0) {
		throw new Error("Object wrapper requires non-empty '__php_class__'");
	}

	const data = requireObject(obj.data, "Object wrapper 'data'");
	const visibilities = parseVisibilityMap(obj.__php_visibility__);
	const propertyClasses = parseStringMap(obj.__php_property_class__, '__php_property_class__');

	for (const key of Object.keys(visibilities)) {
		if (!(key in data)) {
			throw new Error(`Visibility metadata references missing property '${key}'`);
		}
	}

	for (const key of Object.keys(propertyClasses)) {
		if (!(key in data)) {
			throw new Error(`Property class metadata references missing property '${key}'`);
		}
	}

	const properties: PhpObjectProperty[] = Object.entries(data).map(([name, value]) => ({
		name,
		visibility: visibilities[name] ?? 'public',
		className: propertyClasses[name],
		value: fromJson(value)
	}));

	return { type: 'object', className: obj.__php_class__, properties };
}

function requireObject(value: JsonValue | undefined, context: string): JsonObject {
	if (!value || Array.isArray(value) || typeof value !== 'object') {
		throw new Error(`${context} must be an object`);
	}
	return value as JsonObject;
}

function parseArrayKeyMetadataEntry(
	entry: JsonValue,
	index: number
): { type: 'int' | 'string'; value: number | string } {
	if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
		throw new Error(`Array wrapper key metadata at index ${index} must be an object`);
	}

	const keyInfo = entry as Record<string, JsonValue>;
	if (keyInfo.type !== 'int' && keyInfo.type !== 'string') {
		throw new Error(
			`Array wrapper key metadata at index ${index} must include type 'int' or 'string'`
		);
	}

	if (keyInfo.type === 'int') {
		if (typeof keyInfo.value !== 'number' || !Number.isInteger(keyInfo.value)) {
			throw new Error(`Array wrapper int key metadata at index ${index} must include integer value`);
		}
		return { type: 'int', value: keyInfo.value };
	}

	if (typeof keyInfo.value !== 'string') {
		throw new Error(`Array wrapper string key metadata at index ${index} must include string value`);
	}
	return { type: 'string', value: keyInfo.value };
}

function parseVisibilityMap(value: JsonValue | undefined): Record<string, PhpVisibility> {
	if (value === undefined) return {};

	const obj = requireObject(value, '__php_visibility__');
	const visibilityMap: Record<string, PhpVisibility> = {};

	for (const [key, visibility] of Object.entries(obj)) {
		if (visibility !== 'public' && visibility !== 'protected' && visibility !== 'private') {
			throw new Error(`Invalid visibility '${String(visibility)}' for property '${key}'`);
		}
		visibilityMap[key] = visibility;
	}

	return visibilityMap;
}

function parseStringMap(value: JsonValue | undefined, fieldName: string): Record<string, string> {
	if (value === undefined) return {};

	const obj = requireObject(value, fieldName);
	const result: Record<string, string> = {};

	for (const [key, mapValue] of Object.entries(obj)) {
		if (typeof mapValue !== 'string') {
			throw new Error(`${fieldName} values must be strings (invalid entry '${key}')`);
		}
		result[key] = mapValue;
	}

	return result;
}
