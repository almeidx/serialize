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
	__php_property_meta__?: Record<
		string,
		{
			name: string;
			visibility: 'public' | 'protected' | 'private';
			className?: string;
		}
	>;
	__php_property_order__?: string[];
	__php_binary__?: boolean;
	__php_ref_index__?: number;
	__php_ref_object__?: boolean;
	__php_payload_base64__?: string;
	__php_enum_case__?: string;
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
				__php_class__: php.className,
			};

			const data: Record<string, JsonValue> = {};
			const propertyMeta: Record<
				string,
				{ name: string; visibility: PhpVisibility; className?: string }
			> = {};
			const propertyOrder: string[] = [];
			const usedKeys = new Set<string>();

			for (const prop of php.properties) {
				const key = makeUniqueKey(prop.name, usedKeys);
				usedKeys.add(key);
				data[key] = toJson(prop.value);
				propertyOrder.push(key);

				propertyMeta[key] = {
					name: prop.name,
					visibility: prop.visibility,
					className: prop.className,
				};
			}

			result.data = data;
			result.__php_property_meta__ = propertyMeta;
			result.__php_property_order__ = propertyOrder;
			return result;
		}

		case 'custom_object':
			return {
				__php_type__: 'custom_object',
				__php_class__: php.className,
				__php_payload_base64__: btoa(php.payload),
			};

		case 'enum':
			return {
				__php_type__: 'enum',
				__php_class__: php.className,
				__php_enum_case__: php.caseName,
			};

		case 'reference':
			return {
				__php_type__: 'reference',
				__php_ref_index__: php.index,
				__php_ref_object__: php.isObject
			};
	}
}

export function fromJson(json: JsonValue): PhpValue {
	const php = fromJsonInternal(json);
	validateReferenceGraph(php);
	return php;
}

function fromJsonInternal(json: JsonValue): PhpValue {
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
			value: fromJsonInternal(item),
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
					case 'custom_object':
						return fromCustomObjectWrapper(obj);
					case 'enum':
						return fromEnumWrapper(obj);
					default:
						throw new Error(`Unsupported __php_type__ value '${typeTag}'`);
				}
			}

		const entries: PhpArrayEntry[] = Object.entries(obj).map(([key, value]) => ({
			key: { type: 'string' as const, value: key },
			value: fromJsonInternal(value),
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
			value: fromJsonInternal(data[keyStr])
		};
	});

	return { type: 'array', entries };
}

function fromObjectWrapper(obj: JsonObject): PhpValue {
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
		const name = meta?.name ?? key;
		const visibility = meta?.visibility ?? visibilities[key] ?? 'public';
		const className = meta?.className ?? propertyClasses[key];

		return {
			name,
			visibility,
			className,
			value: fromJsonInternal(value),
		};
	});

	return { type: 'object', className: obj.__php_class__, properties };
}

function fromCustomObjectWrapper(obj: JsonObject): PhpValue {
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

function fromEnumWrapper(obj: JsonObject): PhpValue {
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

function makeUniqueKey(baseKey: string, usedKeys: Set<string>): string {
	if (!usedKeys.has(baseKey)) return baseKey;

	let counter = 2;
	let candidate = `${baseKey}#${counter}`;
	while (usedKeys.has(candidate)) {
		counter++;
		candidate = `${baseKey}#${counter}`;
	}

	return candidate;
}

function parsePropertyMetaMap(
	value: JsonValue | undefined,
): Record<string, { name: string; visibility: PhpVisibility; className?: string }> {
	if (value === undefined) return {};

	const obj = requireObject(value, '__php_property_meta__');
	const result: Record<
		string,
		{ name: string; visibility: PhpVisibility; className?: string }
	> = {};

	for (const [key, metaValue] of Object.entries(obj)) {
		if (!metaValue || Array.isArray(metaValue) || typeof metaValue !== 'object') {
			throw new Error(`__php_property_meta__ entry '${key}' must be an object`);
		}

		const meta = metaValue as Record<string, JsonValue>;
		if (typeof meta.name !== 'string') {
			throw new Error(`__php_property_meta__ entry '${key}' must include string 'name'`);
		}
		if (
			meta.visibility !== 'public' &&
			meta.visibility !== 'protected' &&
			meta.visibility !== 'private'
		) {
			throw new Error(
				`__php_property_meta__ entry '${key}' must include valid 'visibility'`,
			);
		}
		if (
			meta.className !== undefined &&
			typeof meta.className !== 'string'
		) {
			throw new Error(
				`__php_property_meta__ entry '${key}' has invalid 'className'`,
			);
		}

		result[key] = {
			name: meta.name,
			visibility: meta.visibility,
			className: meta.className,
		};
	}

	return result;
}

function parsePropertyOrder(
	value: JsonValue | undefined,
	data: JsonObject,
): string[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) {
		throw new Error('__php_property_order__ must be an array when present');
	}

	const seen = new Set<string>();
	const order = value.map((entry, index) => {
		if (typeof entry !== 'string') {
			throw new Error(`__php_property_order__ entry at index ${index} must be a string`);
		}
		if (seen.has(entry)) {
			throw new Error(`__php_property_order__ contains duplicate key '${entry}'`);
		}
		seen.add(entry);
		return entry;
	});

	for (const key of order) {
		if (!(key in data)) {
			throw new Error(`__php_property_order__ references missing property key '${key}'`);
		}
	}

	for (const key of Object.keys(data)) {
		if (!seen.has(key)) {
			throw new Error(`__php_property_order__ is missing property key '${key}'`);
		}
	}

	return order;
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

function validateReferenceGraph(root: PhpValue): void {
	const values: PhpValue[] = [];
	let currentIndex = 0;

	function visit(value: PhpValue): void {
		currentIndex++;
		const index = currentIndex;
		values[index] = value;

		if (value.type === 'reference') {
			if (value.index < 1 || value.index >= index) {
				throw new Error(
					`Reference index ${value.index} points to an unresolved value at node ${index}`,
				);
			}

			const target = resolveReferenceTarget(value.index, values);
			if (!target) {
				throw new Error(`Reference index ${value.index} does not exist`);
			}
			if (value.isObject && !isObjectLikeReferenceTarget(target)) {
				throw new Error(
					`Object reference index ${value.index} must point to an object-like value`,
				);
			}
		}

		switch (value.type) {
			case 'array':
				for (const entry of value.entries) {
					visit(entry.value);
				}
				break;
			case 'object':
				for (const property of value.properties) {
					visit(property.value);
				}
				break;
		}
	}

	visit(root);
}

function resolveReferenceTarget(index: number, values: PhpValue[]): PhpValue | null {
	let current = values[index];
	if (!current) return null;

	const seen = new Set<number>();
	let currentIndex = index;
	while (current.type === 'reference') {
		if (seen.has(currentIndex)) return null;
		seen.add(currentIndex);

		currentIndex = current.index;
		current = values[currentIndex];
		if (!current) return null;
	}

	return current;
}

function isObjectLikeReferenceTarget(value: PhpValue): boolean {
	return (
		value.type === 'object' ||
		value.type === 'custom_object' ||
		value.type === 'enum'
	);
}

function hasBinaryControlCharacters(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
			return true;
		}
	}
	return false;
}
