<script lang="ts">
	import { page } from '$app/state';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} · serialize</title>
</svelte:head>

<div class="flex min-h-full flex-col">
	<SiteHeader />
	<main class="grid flex-1 place-items-center p-6 text-center">
		<div>
			<p class="font-mono text-sm text-muted">{notFound ? 'N;' : `i:${page.status};`}</p>
			<h1 class="mt-2 text-5xl font-semibold tracking-tight">{page.status}</h1>
			<p class="mt-3 text-muted">
				{notFound ? "This page doesn't exist. Nothing to unserialize here." : page.error?.message || 'Something went wrong.'}
			</p>
			<a href="/" class="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">Open the editor</a>
		</div>
	</main>
</div>
