import { describe, expect, it } from "vitest";
import { parse } from "#lib/parser/parse.js";
import { computeStats } from "./stats.js";

describe("computeStats", () => {
	it("computes UTF-8 byte size, node count, depth, and types", () => {
		const serialized = 'a:2:{i:0;s:3:"fé";i:1;O:4:"User":0:{}}';
		const stats = computeStats(parse(serialized), serialized);

		expect(stats).toEqual({
			byteSize: 39,
			nodeCount: 5,
			maxDepth: 2,
			types: { array: 1, int: 2, string: 1, object: 1 },
			classes: ["User"],
		});
	});

	it("includes custom objects and enums in class list", () => {
		const serialized = 'a:2:{i:0;C:11:"CustomThing":3:{abc}i:1;E:11:"Suit:Hearts";}';
		const stats = computeStats(parse(serialized), serialized);

		expect(stats.classes).toEqual(["CustomThing", "Suit"]);
		expect(stats.types.custom_object).toBe(1);
		expect(stats.types.enum).toBe(1);
	});
});
