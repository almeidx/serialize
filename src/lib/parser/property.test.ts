import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";
import { serialize } from "./serialize.js";
import type { PhpObjectProperty, PhpString, PhpValue } from "./types.js";

describe("parser/serializer property tests", () => {
	it("round-trips randomly generated values without references", () => {
		const rng = createRng(42);

		for (let i = 0; i < 200; i++) {
			const generated = randomPhpValue(rng, 0);
			expect(parse(serialize(generated))).toEqual(generated);
		}
	});
});

function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function randomPhpValue(rng: () => number, depth: number): PhpValue {
	if (depth >= 3) return randomLeafValue(rng);

	switch (Math.floor(rng() * 9)) {
		case 0:
			return { type: "null" };
		case 1:
			return { type: "bool", value: rng() > 0.5 };
		case 2:
			return { type: "int", value: Math.floor(rng() * 2000) - 1000 };
		case 3:
			return randomFloatValue(rng);
		case 4:
			return randomStringValue(rng, false);
		case 5:
			return randomArrayValue(rng, depth + 1);
		case 6:
			return randomObjectValue(rng, depth + 1);
		case 7:
			return { type: "custom_object", className: randomClassName(rng), payload: randomStringValue(rng, true).value };
		default:
			return randomEnumValue(rng);
	}
}

function randomLeafValue(rng: () => number): PhpValue {
	switch (Math.floor(rng() * 6)) {
		case 0:
			return { type: "null" };
		case 1:
			return { type: "bool", value: rng() > 0.5 };
		case 2:
			return { type: "int", value: Math.floor(rng() * 100) - 50 };
		case 3:
			return randomFloatValue(rng);
		case 4:
			return randomStringValue(rng, false);
		default:
			return randomEnumValue(rng);
	}
}

function randomFloatValue(rng: () => number): PhpValue {
	const choice = Math.floor(rng() * 8);
	if (choice === 0) return { type: "float", value: Infinity };
	if (choice === 1) return { type: "float", value: -Infinity };
	if (choice === 2) return { type: "float", value: NaN };

	const sign = rng() > 0.5 ? 1 : -1;
	return { type: "float", value: (sign * Math.round(rng() * 10000)) / 100 };
}

function randomStringValue(rng: () => number, allowControl: boolean): PhpString {
	const length = Math.floor(rng() * 6);
	let value = "";

	for (let i = 0; i < length; i++) {
		if (allowControl && rng() < 0.2) {
			value += String.fromCharCode(Math.floor(rng() * 8));
		} else {
			const kind = Math.floor(rng() * 3);
			if (kind === 0) value += String.fromCharCode(97 + Math.floor(rng() * 26));
			else if (kind === 1) value += String.fromCharCode(48 + Math.floor(rng() * 10));
			else value += ["é", "中", "😀"][Math.floor(rng() * 3)];
		}
	}

	return { type: "string", value };
}

function randomArrayValue(rng: () => number, depth: number): PhpValue {
	const length = Math.floor(rng() * 4);
	const entries = [];

	for (let i = 0; i < length; i++) {
		entries.push({
			key: rng() > 0.4 ? ({ type: "int", value: i } as const) : ({ type: "string", value: `k${i}` } as const),
			value: randomPhpValue(rng, depth),
		});
	}

	return { type: "array", entries };
}

function randomObjectValue(rng: () => number, depth: number): PhpValue {
	const className = randomClassName(rng);
	const length = Math.floor(rng() * 4);
	const properties: PhpObjectProperty[] = [];

	for (let i = 0; i < length; i++) {
		const visibilityRoll = rng();
		const visibility = visibilityRoll < 0.34 ? "public" : visibilityRoll < 0.67 ? "protected" : "private";
		const propClassName = visibility === "private" && rng() > 0.5 ? `Other${Math.floor(rng() * 3)}` : undefined;

		properties.push({ name: `p${i}`, visibility, className: propClassName, value: randomPhpValue(rng, depth) });
	}

	return { type: "object", className, properties };
}

function randomEnumValue(rng: () => number): PhpValue {
	return { type: "enum", className: randomClassName(rng), caseName: `Case${Math.floor(rng() * 5)}` };
}

function randomClassName(rng: () => number): string {
	return `Cls${Math.floor(rng() * 20)}`;
}
