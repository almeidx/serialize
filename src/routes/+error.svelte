<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Error'} · Serialize</title>
</svelte:head>

<main
	class="h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
>
	<p class="font-mono text-sm text-zinc-500 dark:text-zinc-400">
		{notFound ? 'N;' : `i:${page.status};`}
	</p>
	<h1 class="text-4xl font-semibold">{page.status}</h1>
	<p class="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
		{notFound
			? "This page doesn't exist. Nothing to unserialize here."
			: (page.error?.message ?? 'Something went wrong.')}
	</p>
	<a
		href={resolve('/')}
		class="mt-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
	>
		Back to Serialize
	</a>
</main>
