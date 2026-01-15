<script lang="ts">
	interface Props {
		jsonPretty: string;
		jsonMinified: string;
		phpSerialized: string;
		disabled?: boolean;
	}

	let { jsonPretty, jsonMinified, phpSerialized, disabled = false }: Props = $props();

	let open = $state(false);
	let copied = $state<string | null>(null);

	async function copyToClipboard(text: string, label: string) {
		await navigator.clipboard.writeText(text);
		copied = label;
		open = false;
		setTimeout(() => (copied = null), 2000);
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.copy-menu')) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative copy-menu">
	<button
		onclick={() => (open = !open)}
		{disabled}
		class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
			bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200
			hover:bg-zinc-200 dark:hover:bg-zinc-600
			disabled:opacity-50 disabled:cursor-not-allowed
			transition-colors"
	>
		{#if copied}
			<svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>Copied!</span>
		{:else}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
				/>
			</svg>
			<span>Copy</span>
			<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50"
		>
			<button
				onclick={() => copyToClipboard(jsonPretty, 'pretty')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				JSON (pretty)
			</button>
			<button
				onclick={() => copyToClipboard(jsonMinified, 'minified')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				JSON (minified)
			</button>
			<button
				onclick={() => copyToClipboard(phpSerialized, 'php')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				PHP Serialized
			</button>
		</div>
	{/if}
</div>
