<script lang="ts">
	import { formatBytes } from '#lib/format.js';
	import type { Stats } from '#lib/stats.js';

	let { stats }: { stats: Stats } = $props();

	const types = $derived(Object.entries(stats.types).sort(([, a], [, b]) => b - a));
</script>

<aside class="w-56 shrink-0 overflow-y-auto border-l border-border bg-surface p-4 text-sm max-md:hidden" aria-label="Statistics">
	<dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
		<dt class="text-muted">Size</dt>
		<dd class="font-mono tabular-nums">{formatBytes(stats.byteSize)}</dd>
		<dt class="text-muted">Nodes</dt>
		<dd class="font-mono tabular-nums">{stats.nodeCount.toLocaleString()}</dd>
		<dt class="text-muted">Depth</dt>
		<dd class="font-mono tabular-nums">{stats.maxDepth}</dd>
	</dl>

	<h2 class="mt-5 mb-1.5 text-xs font-medium text-muted">Types</h2>
	<ul class="space-y-0.5">
		{#each types as [type, count] (type)}
			<li class="flex justify-between gap-3 font-mono text-xs">
				<span>{type}</span>
				<span class="tabular-nums text-muted">{count.toLocaleString()}</span>
			</li>
		{/each}
	</ul>

	{#if stats.classes.length > 0}
		<h2 class="mt-5 mb-1.5 text-xs font-medium text-muted">Classes</h2>
		<ul class="space-y-0.5">
			{#each stats.classes as className (className)}
				<li class="truncate font-mono text-xs text-type" title={className}>{className}</li>
			{/each}
		</ul>
	{/if}
</aside>
