<script lang="ts">
	interface Props {
		id: string;
		currentType: string;
		options: string[];
		onselect?: (value: string) => void;
		disabled?: boolean;
	}

	let {
		id: _id,
		currentType,
		options,
		onselect,
		disabled = false,
	}: Props = $props();

	let open = $state(false);

	function handleTriggerClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		open = !open;
	}

	function handleSelect(value: string) {
		open = false;
		onselect?.(value);
	}

	function handleBlur(event: FocusEvent) {
		const related = event.relatedTarget as HTMLElement | null;
		if (related?.closest('.type-menu-popover')) return;
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		{disabled}
		onclick={handleTriggerClick}
		onblur={handleBlur}
		class="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label="Change type"
		aria-haspopup="menu"
		aria-expanded={open}
	>
		<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
			/>
		</svg>
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="type-menu-popover absolute left-0 top-6 z-50 min-w-25 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg py-1"
			onmousedown={(e) => e.preventDefault()}
		>
			{#each options as option (option)}
				<button
					type="button"
					onclick={() => handleSelect(option)}
					class="w-full text-left px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 {currentType === option
						? 'text-blue-700 dark:text-blue-300 font-medium'
						: 'text-zinc-700 dark:text-zinc-300'}"
				>
					{option}
				</button>
			{/each}
		</div>
	{/if}
</div>
