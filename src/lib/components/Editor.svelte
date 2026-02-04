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
	let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);
	let monaco = $state<typeof Monaco | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let isInternalChange = false;

	onMount(async () => {
		const loader = await import('@monaco-editor/loader');
		const m = await loader.default.init();
		monaco = m;

		const ed = m.editor.create(container, {
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
		editor = ed;

		ed.onDidChangeModelContent(() => {
			if (onchange) {
				isInternalChange = true;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					onchange(ed.getValue());
				}, 300);
			}
		});

		ed.onDidBlurEditorWidget(() => {
			if (onchange) {
				if (debounceTimer) clearTimeout(debounceTimer);
				onchange(ed.getValue());
			}
		});
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (editor) editor.dispose();
	});

	$effect(() => {
		const newValue = value;
		const ed = editor;
		if (ed && monaco && newValue !== ed.getValue()) {
			if (!isInternalChange) {
				ed.setValue(newValue);
			}
		}
		isInternalChange = false;
	});

	$effect(() => {
		if (editor && monaco) {
			monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
		}
	});

	$effect(() => {
		const lang = language;
		if (editor && monaco) {
			const model = editor.getModel();
			if (model) {
				monaco.editor.setModelLanguage(model, lang);
			}
		}
	});
</script>

<div bind:this={container} class="w-full h-full min-h-50"></div>
