export function utf8ByteLength(str: string): number {
	let bytes = 0;

	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		if (code <= 0x7f) {
			bytes += 1;
		} else if (code <= 0x7ff) {
			bytes += 2;
		} else if (code >= 0xd800 && code <= 0xdbff) {
			const next = str.charCodeAt(i + 1);
			if (next < 0xdc00 || next > 0xdfff) {
				throw new Error(`Invalid UTF-16 string: unmatched high surrogate at index ${i}`);
			}
			bytes += 4;
			i++;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			throw new Error(`Invalid UTF-16 string: unexpected low surrogate at index ${i}`);
		} else {
			bytes += 3;
		}
	}

	return bytes;
}
