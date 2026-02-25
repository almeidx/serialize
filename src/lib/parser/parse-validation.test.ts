import { describe, expect, it } from 'vitest';

import { parse } from './parse';

describe('parser validation', () => {
	it('rejects unknown type identifiers', () => {
		expect(() => parse('Z:1;')).toThrow(/Unknown type identifier/);
	});

	it('accepts strict float formats and rejects malformed float literals', () => {
		expect(parse('d:-1.23e+4;')).toEqual({ type: 'float', value: -12300 });
		expect(() => parse('d:1.2foo;')).toThrow(/Invalid float value/);
		expect(() => parse('d:;')).toThrow(/Invalid float value/);
	});

	it('rejects references that point to unresolved indices', () => {
		expect(() => parse('a:1:{i:0;R:9;}')).toThrow(/unresolved value/);
	});

	it('rejects object references to non object-like targets', () => {
		expect(() => parse('a:2:{i:0;s:3:"foo";i:1;r:2;}')).toThrow(
			/object-like value/,
		);
	});

	it('rejects negative array and object counts', () => {
		expect(() => parse('a:-1:{}')).toThrow(/non-negative integer.*array element count/i);
		expect(() => parse('O:3:"Foo":-1:{}')).toThrow(/non-negative integer.*object property count/i);
	});
});
