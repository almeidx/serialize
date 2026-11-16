<script lang="ts">
	import type { JsonValue } from '#lib/converter/types.js';
	import * as menu from '@zag-js/menu';
	import { normalizeProps, useMachine } from '@zag-js/svelte';

	let { data, serialized }: { data: JsonValue | undefined; serialized: string } = $props();

	const STATUS_MS = 2000;

	const formats = [
		['json-pretty', 'JSON (pretty)', () => JSON.stringify(data, null, 2)],
		['json-minified', 'JSON (minified)', () => JSON.stringify(data)],
		['php', 'PHP serialized', () => serialized],
	] as const;

	let status = $state<'copied' | 'failed' | null>(null);
	let statusTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy(format: string) {
		const text = formats.find(([value]) => value === format)?.[2]();
		if (text === undefined) return;
		try {
			await navigator.clipboard.writeText(text);
			status = 'copied';
		} catch {
			status = 'failed';
		}
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = null), STATUS_MS);
	}

	const service = useMachine(menu.machine, () => ({
		id: 'copy-menu',
		positioning: { placement: 'bottom-end' as const, gutter: 4 },
		onSelect: ({ value }) => void copy(value),
	}));
	const api = $derived(menu.connect(service, normalizeProps));

	$effect(() => () => clearTimeout(statusTimer));
</script>

<button
	type="button"
	class="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted hover:bg-raised hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
	disabled={data === undefined}
	{...api.getTriggerProps()}
>
	{#if status === 'copied'}
		<span class="text-success">Copied</span>
	{:else if status === 'failed'}
		<span class="text-error">Copy failed</span>
	{:else}
		Copy
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path d="M4.4 6.4l3.4 3.4a.25.25 0 00.4 0l3.4-3.4a.25.25 0 00-.2-.4H4.6a.25.25 0 00-.2.4z" />
		</svg>
	{/if}
</button>

<div class="z-50" {...api.getPositionerProps()}>
	<div class="min-w-40 rounded-lg border border-border bg-bg p-1 shadow-xl shadow-black/20 outline-none" {...api.getContentProps()}>
		{#each formats as [value, label] (value)}
			<div class="cursor-default rounded-md px-2.5 py-1.5 text-sm data-highlighted:bg-raised" {...api.getItemProps({ value })}>{label}</div>
		{/each}
	</div>
</div>
