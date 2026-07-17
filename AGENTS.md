# Agent guidance

Serialize is a client-side SvelteKit tool for parsing, editing, and converting
PHP serialized values. Cloudflare Workers serves the built application.

Use `README.md` for setup and `package.json` for scripts. Keep this file focused
on format and privacy constraints.

## Data invariants

- `src/lib/parser/` owns the PHP serialized format and its `PhpValue` AST.
  Parser and serializer changes must round-trip supported values and preserve
  PHP string-length semantics.
- `src/lib/converter/json.ts` owns the JSON representation. Preserve the
  metadata wrappers used for PHP object class/visibility information and binary
  strings; ordinary user keys must not be mistaken for metadata.
- Tree and raw-JSON editing are two views of the same AST. Centralize path-based
  updates and avoid independent state that can silently drift between panes.
- Processing is intentionally client-side. Do not add uploads, remote fetching,
  telemetry, or persistence of user input without an explicit product decision.
- Follow the Svelte 5 state and effect patterns already used by the editor and
  tree components, including cleanup for Monaco subscriptions.

## Useful areas

- `src/lib/parser/` — tokenizer/parser, serializer, and AST types
- `src/lib/converter/json.ts` — AST/JSON conversion
- `src/lib/components/EditableTreeView.svelte` — path-based editing
- `src/lib/components/Editor.svelte` — Monaco lifecycle
- `src/routes/+page.svelte` — synchronization between views

## Validation

```sh
pnpm lint
pnpm check
pnpm test
pnpm test:e2e  # editing or synchronization changes
pnpm build     # bundling or Worker changes
```
