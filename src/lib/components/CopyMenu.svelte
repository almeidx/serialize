<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		getJsonPretty: () => string;
		getJsonMinified: () => string;
		getPhpSerialized: () => string;
		disabled?: boolean;
	}

	let { getJsonPretty, getJsonMinified, getPhpSerialized, disabled = false }: Props = $props();

	let open = $state(false);
	let copied = $state<string | null>(null);
	let copyFailed = $state(false);

	let menuRoot = $state<HTMLDivElement | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);
	let firstMenuItem = $state<HTMLButtonElement | null>(null);
	let statusTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleStatusClear() {
		if (statusTimer) clearTimeout(statusTimer);
		statusTimer = setTimeout(() => {
			copied = null;
			copyFailed = false;
		}, 2000);
	}

	async function toggleMenu() {
		if (disabled) return;
		open = !open;
		if (open) {
			await tick();
			firstMenuItem?.focus();
		}
	}

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
			copyFailed = false;
		} catch {
			copied = null;
			copyFailed = true;
		}
		open = false;
		scheduleStatusClear();
		triggerButton?.focus();
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (!menuRoot?.contains(target)) {
			open = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (disabled) {
			open = false;
		}
	});

	$effect(() => {
		return () => {
			if (statusTimer) clearTimeout(statusTimer);
		};
	});
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleWindowKeydown} />

<div class="relative copy-menu" bind:this={menuRoot}>
	<button
		bind:this={triggerButton}
		onclick={toggleMenu}
		{disabled}
		class="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border
				border-zinc-200 dark:border-zinc-700
				text-zinc-500 dark:text-zinc-400
				hover:bg-zinc-100 dark:hover:bg-zinc-800
				disabled:opacity-50 disabled:cursor-not-allowed
				transition-colors"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls="copy-menu-options"
	>
		{#if copyFailed}
			<svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>Copy failed</span>
		{:else if copied}
			<svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>Copied</span>
		{:else}
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
				/>
			</svg>
			<span>Copy</span>
			<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
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
			id="copy-menu-options"
			role="menu"
			class="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50"
		>
			<button
				bind:this={firstMenuItem}
				role="menuitem"
				onclick={() => copyToClipboard(getJsonPretty(), 'pretty')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				JSON (pretty)
			</button>
			<button
				role="menuitem"
				onclick={() => copyToClipboard(getJsonMinified(), 'minified')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				JSON (minified)
			</button>
			<button
				role="menuitem"
				onclick={() => copyToClipboard(getPhpSerialized(), 'php')}
				class="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
			>
				PHP Serialized
				</button>
		</div>
	{/if}
</div>
