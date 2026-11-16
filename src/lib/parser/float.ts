const NON_FINITE: Record<string, number> = { INF: Infinity, "-INF": -Infinity, NAN: NaN };

/** PHP's spelling of a float, including `INF`, `-INF` and `NAN`. */
export function formatFloat(value: number): string {
	if (Number.isNaN(value)) return "NAN";
	if (value === Infinity) return "INF";
	if (value === -Infinity) return "-INF";
	return String(value);
}

/** The non-finite float PHP spells as `text`; `undefined` for anything else. */
export function parseNonFiniteFloat(text: string): number | undefined {
	return Object.hasOwn(NON_FINITE, text) ? NON_FINITE[text] : undefined;
}
