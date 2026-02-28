import { describe, expect, it } from "vitest";

import { parse } from "./parse";
import { serialize } from "./serialize";
import type { PhpObjectProperty, PhpValue } from "./types";

describe("parser/serializer property tests", () => {
	it("round-trips randomly generated values without references", () => {
		const rng = createRng(42);

		for (let i = 0; i < 200; i++) {
			const generated = normalizePhpValue(randomPhpValue(rng, 0));
			const serialized = serialize(generated);
			const reparsed = parse(serialized);
			expect(isSamePhpValue(reparsed, generated)).toBe(true);
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
	const maxDepth = 3;
	if (depth >= maxDepth) {
		return randomLeafValue(rng);
	}

	const choice = Math.floor(rng() * 9);
	switch (choice) {
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
			return randomCustomObjectValue(rng);
		default:
			return randomEnumValue(rng);
	}
}

function randomLeafValue(rng: () => number): PhpValue {
	const choice = Math.floor(rng() * 6);
	switch (choice) {
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
	const value = (sign * Math.round(rng() * 10000)) / 100;
	return { type: "float", value };
}

function randomStringValue(
	rng: () => number,
	allowControl: boolean,
): { type: "string"; value: string; binary?: boolean } {
	const length = Math.floor(rng() * 6);
	let value = "";

	for (let i = 0; i < length; i++) {
		if (allowControl && rng() < 0.2) {
			value += String.fromCharCode(Math.floor(rng() * 8));
		} else {
			const kind = Math.floor(rng() * 3);
			if (kind === 0) {
				value += String.fromCharCode(97 + Math.floor(rng() * 26));
			} else if (kind === 1) {
				value += String.fromCharCode(48 + Math.floor(rng() * 10));
			} else {
				value += ["é", "中", "😀"][Math.floor(rng() * 3)];
			}
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
		const name = `p${i}`;
		const propClassName = visibility === "private" && rng() > 0.5 ? `Other${Math.floor(rng() * 3)}` : undefined;

		properties.push({
			name,
			visibility,
			className: propClassName,
			value: randomPhpValue(rng, depth),
		});
	}

	return { type: "object", className, properties };
}

function randomCustomObjectValue(rng: () => number): PhpValue {
	return {
		type: "custom_object",
		className: randomClassName(rng),
		payload: randomStringValue(rng, true).value,
	};
}

function randomEnumValue(rng: () => number): PhpValue {
	return {
		type: "enum",
		className: randomClassName(rng),
		caseName: `Case${Math.floor(rng() * 5)}`,
	};
}

function randomClassName(rng: () => number): string {
	return `Cls${Math.floor(rng() * 20)}`;
}

function normalizePhpValue(value: PhpValue): PhpValue {
	switch (value.type) {
		case "string":
			return {
				...value,
				binary: hasBinaryControlCharacters(value.value) ? true : undefined,
			};
		case "array":
			return {
				...value,
				entries: value.entries.map((entry) => ({
					key: entry.key,
					value: normalizePhpValue(entry.value),
				})),
			};
		case "object":
			return {
				...value,
				properties: value.properties.map((property) => ({
					...property,
					value: normalizePhpValue(property.value),
				})),
			};
		case "custom_object":
			return {
				...value,
				binary: hasBinaryControlCharacters(value.payload) ? true : undefined,
			};
		default:
			return value;
	}
}

function isSamePhpValue(a: PhpValue, b: PhpValue): boolean {
	if (a.type !== b.type) return false;

	switch (a.type) {
		case "null":
			return true;
		case "bool":
		case "int":
			return a.value === (b as typeof a).value;
		case "float": {
			const right = (b as typeof a).value;
			if (Number.isNaN(a.value) && Number.isNaN(right)) return true;
			return Object.is(a.value, right);
		}
		case "string":
			return a.value === (b as typeof a).value && (a.binary ?? false) === ((b as typeof a).binary ?? false);
		case "array": {
			const right = b as typeof a;
			if (a.entries.length !== right.entries.length) return false;
			return a.entries.every((entry, index) => {
				const rightEntry = right.entries[index];
				return (
					entry.key.type === rightEntry.key.type &&
					entry.key.value === rightEntry.key.value &&
					isSamePhpValue(entry.value, rightEntry.value)
				);
			});
		}
		case "object": {
			const right = b as typeof a;
			if (a.className !== right.className) return false;
			if (a.properties.length !== right.properties.length) return false;
			return a.properties.every((property, index) => {
				const rightProperty = right.properties[index];
				return (
					property.name === rightProperty.name &&
					property.visibility === rightProperty.visibility &&
					property.className === rightProperty.className &&
					isSamePhpValue(property.value, rightProperty.value)
				);
			});
		}
		case "custom_object":
			return (
				a.className === (b as typeof a).className &&
				a.payload === (b as typeof a).payload &&
				(a.binary ?? false) === ((b as typeof a).binary ?? false)
			);
		case "enum":
			return a.className === (b as typeof a).className && a.caseName === (b as typeof a).caseName;
		case "reference":
			return a.index === (b as typeof a).index && a.isObject === (b as typeof a).isObject;
	}
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
