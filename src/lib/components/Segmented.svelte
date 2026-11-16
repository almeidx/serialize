<script lang="ts" generics="T extends string">
	interface Props {
		label: string;
		options: ReadonlyArray<readonly [value: T, label: string]>;
		value: T;
		onchange: (value: T) => void;
	}

	let { label, options, value, onchange }: Props = $props();
</script>

<div class="flex shrink-0 rounded-lg bg-raised p-0.5 text-xs font-medium" role="radiogroup" aria-label={label}>
	{#each options as [option, text] (option)}
		<button
			type="button"
			role="radio"
			aria-checked={value === option}
			class="rounded-md px-2.5 py-1 text-muted hover:text-fg aria-checked:bg-bg aria-checked:text-fg aria-checked:shadow-sm"
			onclick={() => onchange(option)}
		>
			{text}
		</button>
	{/each}
</div>
