<script lang="ts">
	import type { Stats } from '../stats';

	interface Props {
		stats: Stats | null;
		collapsed?: boolean;
		oncollapse?: () => void;
	}

	let { stats, collapsed = false, oncollapse }: Props = $props();
	let mobileExpanded = $state(false);

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if stats}
	<aside
		class="md:hidden border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 shrink-0"
	>
		<button
			onclick={() => (mobileExpanded = !mobileExpanded)}
			class="w-full px-3 py-2 text-xs text-left text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
		>
			Stats: {formatBytes(stats.byteSize)} • {stats.nodeCount} nodes • depth {stats.maxDepth}
		</button>
		{#if mobileExpanded}
			<div class="px-3 pb-3 space-y-3 text-xs">
				<div>
					<h3
						class="font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1"
					>
						Types
					</h3>
					<ul class="space-y-1">
						{#each Object.entries(stats.types) as [type, count] (type)}
							<li class="flex justify-between">
								<span class="text-zinc-600 dark:text-zinc-400">{type}</span>
								<span class="text-zinc-900 dark:text-zinc-100 font-mono"
									>{count}</span
								>
							</li>
						{/each}
					</ul>
				</div>
				{#if stats.classes.length > 0}
					<div>
						<h3
							class="font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1"
						>
							Classes
						</h3>
						<ul class="space-y-1">
							{#each stats.classes as className (className)}
								<li class="text-cyan-600 dark:text-cyan-400 font-mono truncate">
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
	class="hidden md:flex bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 transition-all duration-200 {collapsed
		? 'w-10'
		: 'w-56'} shrink-0 flex-col"
>
	<button
		onclick={oncollapse}
		class="h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-200 dark:border-zinc-700"
		title={collapsed ? 'Expand stats' : 'Collapse stats'}
	>
		<svg
			class="w-4 h-4 text-zinc-500 transition-transform {collapsed
				? 'rotate-180'
				: ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 5l7 7-7 7"
			/>
		</svg>
	</button>

	{#if !collapsed && stats}
		<div class="p-3 space-y-4 text-sm overflow-y-auto">
			<div>
				<h3
					class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2"
				>
					Size
				</h3>
				<p class="text-zinc-900 dark:text-zinc-100 font-mono">
					{formatBytes(stats.byteSize)}
				</p>
			</div>

			<div>
				<h3
					class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2"
				>
					Nodes
				</h3>
				<p class="text-zinc-900 dark:text-zinc-100 font-mono">
					{stats.nodeCount}
				</p>
			</div>

			<div>
				<h3
					class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2"
				>
					Depth
				</h3>
				<p class="text-zinc-900 dark:text-zinc-100 font-mono">
					{stats.maxDepth}
				</p>
			</div>

			<div>
				<h3
					class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2"
				>
					Types
				</h3>
				<ul class="space-y-1">
					{#each Object.entries(stats.types) as [type, count] (type)}
						<li class="flex justify-between">
							<span class="text-zinc-600 dark:text-zinc-400">{type}</span>
							<span class="text-zinc-900 dark:text-zinc-100 font-mono"
								>{count}</span
							>
						</li>
					{/each}
				</ul>
			</div>

			{#if stats.classes.length > 0}
				<div>
					<h3
						class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2"
					>
						Classes
					</h3>
					<ul class="space-y-1">
						{#each stats.classes as className (className)}
							<li
								class="text-cyan-600 dark:text-cyan-400 font-mono text-xs truncate"
							>
								{className}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</aside>
