# Serialize - AI Agent Guidelines

## Project Overview

A client-side web tool for parsing, editing, and converting PHP serialized data. Built with SvelteKit 5 and deployed to Cloudflare Workers.

**Live:** https://serialize.almeidx.dev

## Tech Stack

- **Framework:** SvelteKit 5 (Svelte 5 runes)
- **Styling:** Tailwind CSS 4
- **Editor:** Monaco Editor
- **Deployment:** Cloudflare Workers (adapter-cloudflare)
- **Package Manager:** pnpm

## Project Structure

```
src/
├── lib/
│   ├── parser/           # PHP serialization parser (custom built)
│   │   ├── parse.ts      # PHP serialized → AST
│   │   ├── serialize.ts  # AST → PHP serialized
│   │   └── types.ts      # Type definitions
│   ├── converter/
│   │   └── json.ts       # AST ↔ JSON with metadata preservation
│   ├── components/
│   │   ├── EditableTreeView.svelte  # Editable tree with inline editing
│   │   ├── Editor.svelte            # Monaco wrapper
│   │   ├── StatsPanel.svelte        # Collapsible stats sidebar
│   │   ├── ErrorBanner.svelte       # Parse error display
│   │   └── CopyMenu.svelte          # Copy dropdown
│   └── stats.ts          # Statistics computation
├── routes/
│   └── +page.svelte      # Main (only) page
└── app.html
```

## Architecture

### UI Layout

- **Left pane:** Monaco editor for input (PHP serialized or JSON)
- **Right pane:** Output with toggle between editable tree view and raw JSON
- **Stats sidebar:** Collapsible panel showing byte size, node count, depth, types

### Data Flow

1. User enters PHP serialized string or JSON in left pane
2. Parser converts to internal AST (`PhpValue` types)
3. Converter transforms AST to JSON with metadata preservation
4. Output displayed in tree view or JSON editor
5. Edits in tree/JSON sync back to input (bidirectional)

### PHP Metadata Preservation

PHP objects are represented as wrapper objects in JSON:
```json
{
  "__php_type__": "object",
  "__php_class__": "User",
  "__php_visibility__": { "password": "private" },
  "data": { "name": "Alice", "password": "secret" }
}
```

Binary strings are base64 encoded with `__php_binary__: true`.

## Key Patterns

- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- Monaco editor requires `$state` for reactive updates
- Tree editing uses path-based updates (`handleTreeChange`)
- Debounced input processing (300ms)

## Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm check    # Type check
pnpm preview  # Preview production build
```

## Non-Features (By Design)

- No localStorage/history (privacy-first)
- No file upload or URL fetching
- No keyboard shortcuts
- No search/filter in tree
