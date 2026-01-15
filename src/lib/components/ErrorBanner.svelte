<script lang="ts">
	interface Props {
		error: Error | null;
		ondismiss?: () => void;
	}

	let { error, ondismiss }: Props = $props();
</script>

{#if error}
	<div
		class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-3"
	>
		<svg
			class="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
				clip-rule="evenodd"
			/>
		</svg>

		<div class="flex-1 min-w-0">
			<p class="text-sm font-medium text-red-800 dark:text-red-200">Parse Error</p>
			<p class="text-sm text-red-700 dark:text-red-300 mt-1 font-mono break-all">
				{error.message}
			</p>
		</div>

		{#if ondismiss}
			<button
				onclick={ondismiss}
				aria-label="Dismiss error"
				class="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 shrink-0"
			>
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{/if}
	</div>
{/if}
