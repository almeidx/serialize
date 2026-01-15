<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as Monaco from 'monaco-editor';

	interface Props {
		value: string;
		language?: string;
		readonly?: boolean;
		onchange?: (value: string) => void;
		theme?: 'light' | 'dark';
	}

	let { value, language = 'json', readonly = false, onchange, theme = 'dark' }: Props = $props();

	let container: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
	let monaco: typeof Monaco | null = null;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		const loader = await import('@monaco-editor/loader');
		monaco = await loader.default.init();

		editor = monaco.editor.create(container, {
			value,
			language,
			theme: theme === 'dark' ? 'vs-dark' : 'vs',
			readOnly: readonly,
			minimap: { enabled: false },
			fontSize: 13,
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			wordWrap: 'on',
			padding: { top: 8, bottom: 8 }
		});

		editor.onDidChangeModelContent(() => {
			if (onchange && editor) {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					if (editor) {
						onchange(editor.getValue());
					}
				}, 500);
			}
		});

		editor.onDidBlurEditorWidget(() => {
			if (onchange && editor) {
				if (debounceTimer) clearTimeout(debounceTimer);
				onchange(editor.getValue());
			}
		});
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (editor) editor.dispose();
	});

	$effect(() => {
		if (editor && monaco) {
			const currentValue = editor.getValue();
			if (value !== currentValue) {
				editor.setValue(value);
			}
		}
	});

	$effect(() => {
		if (editor && monaco) {
			monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
		}
	});
</script>

<div bind:this={container} class="w-full h-full min-h-[200px]"></div>
