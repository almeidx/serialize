import type { PhpArrayEntry, PhpObjectProperty, PhpValue } from '../parser/types';
import type { JsonObject, JsonValue } from './types';
import {
	hasBinaryControlCharacters,
	makeUniqueKey,
	parseArrayKeyMetadataEntry,
	parsePropertyMetaMap,
	parsePropertyOrder,
	parseStringMap,
	parseVisibilityMap,
	requireObject,
} from './validation';

export function toBinaryWrapper(value: string): JsonObject {
	return {
		__php_type__: 'string',
		__php_binary__: true,
		value: btoa(value),
	};
}

export function toReferenceWrapper(index: number, isObject: boolean): JsonObject {
	return {
		__php_type__: 'reference',
		__php_ref_index__: index,
		__php_ref_object__: isObject,
	};
}

export function toArrayWrapper(
	entries: PhpArrayEntry[],
	toJsonValue: (value: PhpValue) => JsonValue
): JsonObject {
	const result: JsonObject = {
		__php_type__: 'array',
		__php_original_keys__: entries.map((entry) => ({
			type: entry.key.type as 'int' | 'string',
			value: entry.key.value,
		})) as JsonValue,
	};

	const data: JsonObject = {};
	for (const entry of entries) {
		const key = entry.key.type === 'int' ? String(entry.key.value) : entry.key.value;
		data[key] = toJsonValue(entry.value);
	}
	result.data = data;

	return result;
}

export function toObjectWrapper(
	className: string,
	properties: PhpObjectProperty[],
	toJsonValue: (value: PhpValue) => JsonValue
): JsonObject {
	const result: JsonObject = {
		__php_type__: 'object',
		__php_class__: className,
	};

	const data: JsonObject = {};
	const propertyMeta: JsonObject = {};
	const propertyOrder: string[] = [];
	const usedKeys = new Set<string>();

	for (const property of properties) {
		const key = makeUniqueKey(property.name, usedKeys);
		usedKeys.add(key);
		data[key] = toJsonValue(property.value);
		propertyOrder.push(key);

		propertyMeta[key] = {
			name: property.name,
			visibility: property.visibility,
			className: property.className,
		} as JsonValue;
	}

	result.data = data;
	result.__php_property_meta__ = propertyMeta;
	result.__php_property_order__ = propertyOrder as JsonValue;
	return result;
}

export function toCustomObjectWrapper(className: string, payload: string): JsonObject {
	return {
		__php_type__: 'custom_object',
		__php_class__: className,
		__php_payload_base64__: btoa(payload),
	};
}

export function toEnumWrapper(className: string, caseName: string): JsonObject {
	return {
		__php_type__: 'enum',
		__php_class__: className,
		__php_enum_case__: caseName,
	};
}

export function fromBinaryWrapper(obj: JsonObject): PhpValue {
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
		binary: true,
	};
}

export function fromReferenceWrapper(obj: JsonObject): PhpValue {
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
		isObject: obj.__php_ref_object__,
	};
}

export function fromArrayWrapper(
	obj: JsonObject,
	fromJsonValue: (json: JsonValue) => PhpValue
): PhpValue {
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
					? { type: 'int', value: keyInfo.value as number }
					: { type: 'string', value: keyInfo.value as string },
			value: fromJsonValue(data[keyStr]),
		};
	});

	return { type: 'array', entries };
}

export function fromObjectWrapper(
	obj: JsonObject,
	fromJsonValue: (json: JsonValue) => PhpValue
): PhpValue {
	if (typeof obj.__php_class__ !== 'string' || obj.__php_class__.length === 0) {
		throw new Error("Object wrapper requires non-empty '__php_class__'");
	}

	const data = requireObject(obj.data, "Object wrapper 'data'");
	const propertyMeta = parsePropertyMetaMap(obj.__php_property_meta__);
	const propertyOrder = parsePropertyOrder(obj.__php_property_order__, data);
	const visibilities = parseVisibilityMap(obj.__php_visibility__);
	const propertyClasses = parseStringMap(obj.__php_property_class__, '__php_property_class__');

	for (const key of Object.keys(propertyMeta)) {
		if (!(key in data)) {
			throw new Error(`Property metadata references missing property key '${key}'`);
		}
	}

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

	const keyOrder = propertyOrder ?? Object.keys(data);
	const properties: PhpObjectProperty[] = keyOrder.map((key) => {
		const value = data[key];
		if (value === undefined) {
			throw new Error(`Object wrapper order references missing property key '${key}'`);
		}

		const meta = propertyMeta[key];
		return {
			name: meta?.name ?? key,
			visibility: meta?.visibility ?? visibilities[key] ?? 'public',
			className: meta?.className ?? propertyClasses[key],
			value: fromJsonValue(value),
		};
	});

	return { type: 'object', className: obj.__php_class__, properties };
}

export function fromCustomObjectWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_class__ !== 'string' || obj.__php_class__.length === 0) {
		throw new Error("Custom object wrapper requires non-empty '__php_class__'");
	}
	if (typeof obj.__php_payload_base64__ !== 'string') {
		throw new Error("Custom object wrapper requires '__php_payload_base64__' string");
	}

	let payload: string;
	try {
		payload = atob(obj.__php_payload_base64__);
	} catch {
		throw new Error('Custom object wrapper contains invalid base64 payload');
	}

	return {
		type: 'custom_object',
		className: obj.__php_class__,
		payload,
		binary: hasBinaryControlCharacters(payload) ? true : undefined,
	};
}

export function fromEnumWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_class__ !== 'string' || obj.__php_class__.length === 0) {
		throw new Error("Enum wrapper requires non-empty '__php_class__'");
	}
	if (typeof obj.__php_enum_case__ !== 'string' || obj.__php_enum_case__.length === 0) {
		throw new Error("Enum wrapper requires non-empty '__php_enum_case__'");
	}

	return {
		type: 'enum',
		className: obj.__php_class__,
		caseName: obj.__php_enum_case__,
	};
}
