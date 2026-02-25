import { describe, expect, it } from 'vitest';

import { fromJson, toJson } from './converter';
import { parse, serialize } from './parser';

describe('barrel exports', () => {
	it('exports parser helpers from parser index', () => {
		const parsed = parse('s:3:"foo";');
		expect(parsed).toEqual({ type: 'string', value: 'foo' });
		expect(serialize(parsed)).toBe('s:3:"foo";');
	});

	it('exports converter helpers from converter index', () => {
		const json = toJson(parse('a:1:{i:0;s:3:"foo";}'));
		expect(json).toEqual(['foo']);
		expect(serialize(fromJson(json))).toBe('a:1:{i:0;s:3:"foo";}');
	});
});
