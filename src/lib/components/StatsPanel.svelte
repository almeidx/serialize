<script lang="ts">
	import * as collapsible from '@zag-js/collapsible';
	import { mergeProps, normalizeProps, useMachine } from '@zag-js/svelte';
	import type { Stats } from '../stats';

	interface Props {
		stats: Stats | null;
		collapsed?: boolean;
		oncollapse?: () => void;
	}

	let { stats, collapsed = false, oncollapse }: Props = $props();

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	const mobileService = useMachine(collapsible.machine, () => ({
		id: 'stats-mobile',
		defaultOpen: false,
		ids: {
			root: 'stats-mobile-root',
			trigger: 'stats-mobile-trigger',
			content: 'stats-mobile-content',
		},
	}));
	const desktopService = useMachine(collapsible.machine, () => ({
		id: 'stats-desktop',
		open: !collapsed,
		ids: {
			root: 'stats-desktop-root',
			trigger: 'stats-desktop-trigger',
			content: 'stats-desktop-content',
		},
		onOpenChange: (details) => {
			if (details.open === collapsed) {
				oncollapse?.();
			}
		},
	}));

	const mobileApi = $derived(collapsible.connect(mobileService, normalizeProps));
	const desktopApi = $derived(collapsible.connect(desktopService, normalizeProps));
</script>

{#if stats}
	<aside
		{...mergeProps(mobileApi.getRootProps(), {
			class:
				'md:hidden border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 shrink-0',
		})}
	>
		<button
			type="button"
			{...mergeProps(mobileApi.getTriggerProps(), {
				class:
					'w-full px-3 py-2 text-xs text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors',
			})}
		>
			Stats: {formatBytes(stats.byteSize)} • {stats.nodeCount} nodes • depth {stats.maxDepth}
		</button>
		{#if mobileApi.visible}
			<div
				{...mergeProps(mobileApi.getContentProps(), {
					class: 'px-3 pb-3 space-y-3 text-xs',
				})}
			>
				<div>
					<h3 class="font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-1">
						Types
					</h3>
					<ul class="space-y-1">
						{#each Object.entries(stats.types) as [type, count] (type)}
							<li class="flex justify-between">
								<span class="text-zinc-700 dark:text-zinc-300">{type}</span>
								<span class="text-zinc-950 dark:text-zinc-100 font-mono">{count}</span>
							</li>
						{/each}
					</ul>
				</div>
				{#if stats.classes.length > 0}
					<div>
						<h3 class="font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-1">
							Classes
						</h3>
						<ul class="space-y-1">
							{#each stats.classes as className (className)}
								<li class="text-cyan-700 dark:text-cyan-300 font-mono truncate">
									{className}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</aside>
{/if}

<aside
	{...mergeProps(desktopApi.getRootProps(), {
		class: `hidden md:flex bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 transition-all duration-200 ${
			desktopApi.open ? 'w-56' : 'w-10'
		} shrink-0 flex-col`,
	})}
>
	<button
		type="button"
		{...mergeProps(desktopApi.getTriggerProps(), {
			class:
				'h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-200 dark:border-zinc-700',
			'aria-label': desktopApi.open ? 'Collapse stats' : 'Expand stats',
		})}
	>
		<svg
			class="w-4 h-4 text-zinc-600 dark:text-zinc-300 transition-transform {desktopApi.open
				? ''
				: 'rotate-180'}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
	</button>

	{#if desktopApi.visible}
		<div
			{...mergeProps(desktopApi.getContentProps(), {
				class: 'p-3 space-y-4 text-sm overflow-y-auto',
			})}
		>
			{#if stats}
				<div>
					<h3 class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-2">Size</h3>
					<p class="text-zinc-950 dark:text-zinc-100 font-mono">{formatBytes(stats.byteSize)}</p>
				</div>

				<div>
					<h3 class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-2">Nodes</h3>
					<p class="text-zinc-950 dark:text-zinc-100 font-mono">{stats.nodeCount}</p>
				</div>

				<div>
					<h3 class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-2">Depth</h3>
					<p class="text-zinc-950 dark:text-zinc-100 font-mono">{stats.maxDepth}</p>
				</div>

				<div>
					<h3 class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-2">Types</h3>
					<ul class="space-y-1">
						{#each Object.entries(stats.types) as [type, count] (type)}
							<li class="flex justify-between">
								<span class="text-zinc-700 dark:text-zinc-300">{type}</span>
								<span class="text-zinc-950 dark:text-zinc-100 font-mono">{count}</span>
							</li>
						{/each}
					</ul>
				</div>

				{#if stats.classes.length > 0}
					<div>
						<h3 class="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase mb-2">Classes</h3>
						<ul class="space-y-1">
							{#each stats.classes as className (className)}
								<li class="text-cyan-700 dark:text-cyan-300 font-mono text-xs truncate">
									{className}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</aside>
