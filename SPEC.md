# Serialize - PHP Serialization Tool

**URL:** serialize.almeidx.dev
**Stack:** SvelteKit + Cloudflare Workers (adapter-cloudflare)
**Package Manager:** pnpm

## Overview

A client-side web tool for parsing, editing, and converting PHP serialized data. Targeted at developers debugging legacy PHP applications who need to inspect/modify session data, cached values, and other serialized structures.

## Core Features

### Parsing & Conversion
- **Bidirectional conversion:** PHP serialized ↔ JSON (full round-trip)
- **Metadata preservation:** PHP-specific constructs (class names, visibility markers, references) preserved using wrapper objects
- **Strict error handling:** Fail on malformed data with exact byte position and context (recovery mode may be added later)
- **Streaming/chunked processing:** Handle large serialized strings without blocking the browser

### Metadata Format
PHP objects represented as wrapper objects in JSON:
```json
{
  "__php_class__": "User",
  "__php_type__": "object",
  "data": {
    "name": "value",
    ...
  }
}
```

Binary strings encoded as base64 with appropriate markers for round-trip fidelity.

## User Interface

### Layout
- **Split view:** Tree view + Monaco JSON editor side-by-side
- **Responsive:** Horizontal split on desktop, vertical stack on mobile
- **Draggable divider:** User-resizable panes
- **Theme:** System preference (dark/light) with manual toggle

### Input Area
- Paste-only textarea (no file upload or URL fetching)
- "Load Example" button with a typical PHP session array

### Output Area
- **Left pane:** Interactive tree view (collapsed by default)
- **Right pane:** Monaco Editor with JSON syntax highlighting
- **Sync behavior:** Changes reflect after ~500ms pause or blur (debounced)

### Stats Sidebar
Collapsible right sidebar showing:
- Total byte size
- Node count
- Maximum depth
- Types found (strings, arrays, objects, etc.)

### Error Handling
- Inline red banner above input area
- Shows exact byte position, expected vs found, and surrounding context
- Dismissible

### Copy Functionality
Dropdown menu with options:
- Copy as JSON (pretty-printed)
- Copy as JSON (minified)
- Copy as PHP serialized

## Technical Decisions

### Parser Implementation
- Evaluate existing npm packages (e.g., `php-serialize`) for correctness and feature coverage
- Build from scratch if existing packages don't handle all PHP serialization features correctly
- Must support: arrays, objects with class names, references, private/protected properties, binary strings, null bytes

### Dependencies
- **Editor:** Monaco Editor (~2MB, familiar VS Code UX)
- **Tree view:** svelte-tree-view if actively maintained and suitable; otherwise custom Svelte component
- **Styling:** Tailwind CSS

### Output Formats
- JSON only for MVP
- Architecture designed for extensibility (YAML, PHP var_export, etc. can be added later)

## Non-Features (Explicit Exclusions for MVP)

- No history/localStorage persistence (privacy-first)
- No keyboard shortcuts
- No search/filter within parsed structure
- No URL sharing
- No file upload or URL fetching input methods

## Project Structure

```
serialize/
├── src/
│   ├── lib/
│   │   ├── parser/          # PHP serialization parser
│   │   │   ├── parse.ts     # PHP serialized → internal AST
│   │   │   ├── serialize.ts # Internal AST → PHP serialized
│   │   │   └── types.ts     # Type definitions
│   │   ├── converter/       # Format conversion
│   │   │   └── json.ts      # AST ↔ JSON with metadata
│   │   ├── components/
│   │   │   ├── TreeView.svelte
│   │   │   ├── Editor.svelte      # Monaco wrapper
│   │   │   ├── StatsPanel.svelte
│   │   │   ├── ErrorBanner.svelte
│   │   │   └── CopyMenu.svelte
│   │   └── stores/
│   │       └── state.ts     # Svelte stores for app state
│   ├── routes/
│   │   └── +page.svelte     # Main (only) page
│   └── app.html
├── static/
├── tailwind.config.js
├── svelte.config.js
└── package.json
```

## Example Data

Single example: A typical PHP session array demonstrating various types:
```php
a:4:{s:4:"user";O:4:"User":2:{s:4:"name";s:5:"Alice";s:5:"email";s:17:"alice@example.com";}s:5:"roles";a:2:{i:0;s:5:"admin";i:1;s:4:"user";}s:9:"loginTime";i:1704067200;s:8:"isActive";b:1;}
```
