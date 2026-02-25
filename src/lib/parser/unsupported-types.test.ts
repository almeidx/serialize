import { describe, expect, it } from 'vitest';

import { parse } from './parse';

describe('unsupported php serialized tokens', () => {
	it("returns a specific error for custom object payloads ('C')", () => {
		expect(() => parse('C:3:"Foo":0:{}')).toThrow(/custom objects \('C'\) are not currently supported/);
	});

	it("returns a specific error for enum payloads ('E')", () => {
		expect(() => parse('E:3:"Foo"')).toThrow(/enums \('E'\) are not currently supported/);
	});
});
