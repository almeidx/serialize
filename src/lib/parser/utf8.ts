/**
 * UTF-8 byte count of the code point starting at `index`, or 0 for an unpaired surrogate.
 * A 4-byte code point spans two UTF-16 code units.
 */
export function utf8Width(text: string, index: number): number {
	const code = text.charCodeAt(index);
	if (code <= 0x7f) return 1;
	if (code <= 0x7ff) return 2;
	if (code >= 0xd800 && code <= 0xdbff) {
		const next = text.charCodeAt(index + 1);
		return next >= 0xdc00 && next <= 0xdfff ? 4 : 0;
	}
	if (code >= 0xdc00 && code <= 0xdfff) return 0;
	return 3;
}

export function utf8ByteLength(text: string): number {
	let bytes = 0;
	for (let i = 0; i < text.length;) {
		const width = utf8Width(text, i);
		if (width === 0) throw new Error(`Invalid UTF-16 string: unpaired surrogate at index ${i}`);
		bytes += width;
		i += width === 4 ? 2 : 1;
	}
	return bytes;
}
