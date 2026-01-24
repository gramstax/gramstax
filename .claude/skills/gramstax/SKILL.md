---
name: gramstax
description: Gramstax function finder for API docs in ./assets/markdown; use to locate classes, methods, properties, and type aliases in the generated markdown reference.
---

# Gramstax Context Finder

## Overview

Use the bundled reference to navigate the generated API markdown and locate the exact doc file for a class, method, property, or type alias. This skill is docs-first and docs-only.

## Workflow

1. If the index is stale or missing entries, run the generator script (see Automation) and then read `references/context-finder.md`.
2. Open `references/context-finder.md` to identify the correct entry point and name.
3. Read the matching markdown file under `./assets/markdown`.
4. If a member is part of `Ctx`, open `./assets/markdown/gramstax.ctx.md` first, then follow the linked member file.
5. For example requests (e.g., `inlineKeyboardT`), open the member doc and use its `## Example` section.

## AI Usage Guide

- Always consult `references/context-finder.md` first for symbol-to-file mapping.
- For example requests, prefer the `## Example` section in the member doc.
- If a symbol is missing from docs, ask the user to regenerate docs or clarify the symbol. Do not search the codebase.

## Hard rules

- Do not grep or search the codebase for examples.
- Do not use repo-wide search tools for API lookup.
- Only use the generated markdown docs under `./assets/markdown`.
- If a symbol is not found in docs, report it as missing and ask the user for clarification or doc regeneration; do not fall back to code search.

## Resources

- `references/context-finder.md`: Full index of package entries and Ctx members.

## Conventions

- Each API member has its own markdown file named `gramstax.<entity>.<member>.md`.
- The docs are generated; do not edit files under `./assets/markdown`.
