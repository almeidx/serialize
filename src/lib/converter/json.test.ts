import { describe, expect, it } from 'vitest';

import type { PhpValue } from '../parser';
import { fromJson, toJson, type JsonValue } from './json';

describe('fromJson metadata validation', () => {
	it('converts PHP array wrappers with typed original keys', () => {
		const json: JsonValue = {
			__php_type__: 'array',
			__php_original_keys__: [
				{ type: 'int', value: 1 },
				{ type: 'string', value: 'foo' }
			],
			data: {
				1: 'one',
				foo: 'bar'
			}
		};

		expect(fromJson(json)).toEqual({
			type: 'array',
			entries: [
				{
					key: { type: 'int', value: 1 },
					value: { type: 'string', value: 'one' }
				},
				{
					key: { type: 'string', value: 'foo' },
					value: { type: 'string', value: 'bar' }
				}
			]
		});
	});

	it('rejects malformed reference metadata', () => {
		const malformed = {
			__php_type__: 'reference',
			__php_ref_index__: '1',
			__php_ref_object__: true
		} as unknown as JsonValue;

		expect(() => fromJson(malformed)).toThrow(/integer __php_ref_index__/);
	});

	it('rejects array metadata that references missing keys', () => {
		const malformed: JsonValue = {
			__php_type__: 'array',
			__php_original_keys__: [{ type: 'string', value: 'missing' }],
			data: {}
		};

		expect(() => fromJson(malformed)).toThrow(/missing from data/);
	});

	it('rejects invalid binary string payloads', () => {
		const malformed: JsonValue = {
			__php_type__: 'string',
			__php_binary__: true,
			value: '%%%not-base64%%%'
		};

		expect(() => fromJson(malformed)).toThrow(/invalid base64/i);
	});

	it('rejects visibility metadata for non-existent properties', () => {
		const malformed: JsonValue = {
			__php_type__: 'object',
			__php_class__: 'User',
			__php_visibility__: { missing: 'private' },
			data: { name: 'Alice' }
		};

		expect(() => fromJson(malformed)).toThrow(/missing property 'missing'/);
	});
});

describe('toJson/fromJson round-trip', () => {
	it('preserves object metadata across conversion', () => {
		const input: PhpValue = {
			type: 'object',
			className: 'User',
			properties: [
				{
					name: 'name',
					visibility: 'public',
					value: { type: 'string', value: 'Alice' }
				},
				{
					name: 'password',
					visibility: 'private',
					className: 'User',
					value: { type: 'string', value: 'secret' }
				}
			]
		};

		expect(fromJson(toJson(input))).toEqual({
			type: 'object',
			className: 'User',
			properties: [
				{
					name: 'name',
					visibility: 'public',
					className: undefined,
					value: { type: 'string', value: 'Alice' }
				},
				{
					name: 'password',
					visibility: 'private',
					className: 'User',
					value: { type: 'string', value: 'secret' }
				}
			]
		});
	});

	it('preserves binary string wrappers', () => {
		const input: PhpValue = {
			type: 'string',
			value: `a${String.fromCharCode(0)}b`,
			binary: true
		};

		expect(fromJson(toJson(input))).toEqual(input);
	});

	it('preserves reference wrappers', () => {
		const input: PhpValue = {
			type: 'reference',
			index: 7,
			isObject: true
		};

		expect(fromJson(toJson(input))).toEqual(input);
	});
});
