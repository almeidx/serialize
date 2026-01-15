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
		const obj = json as Record<string, JsonValue>;

		if (obj.__php_type__ === 'string' && obj.__php_binary__) {
			return {
				type: 'string',
				value: atob(obj.value as string),
				binary: true
			};
		}

		if (obj.__php_type__ === 'reference') {
			return {
				type: 'reference',
				index: obj.__php_ref_index__ as number,
				isObject: obj.__php_ref_object__ as boolean
			};
		}

		if (obj.__php_type__ === 'array') {
			const data = obj.data as Record<string, JsonValue>;
			const originalKeys = obj.__php_original_keys__ as Array<{
				type: 'int' | 'string';
				value: number | string;
			}>;

			const entries: PhpArrayEntry[] = originalKeys.map((keyInfo) => {
				const keyStr = String(keyInfo.value);
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

		if (obj.__php_type__ === 'object') {
			const className = obj.__php_class__ as string;
			const data = obj.data as Record<string, JsonValue>;
			const visibilities = (obj.__php_visibility__ || {}) as Record<
				string,
				'public' | 'protected' | 'private'
			>;
			const propertyClasses = (obj.__php_property_class__ || {}) as Record<string, string>;

			const properties: PhpObjectProperty[] = Object.entries(data).map(([name, value]) => ({
				name,
				visibility: visibilities[name] || 'public',
				className: propertyClasses[name],
				value: fromJson(value)
			}));

			return { type: 'object', className, properties };
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
