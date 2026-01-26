---
name: gramstax-docs-finder
description: Deterministically retrieve Gramstax API docs from DocFX/API-Extractor YAML. Resolve symbols by UID (gramstax!Name:class/type) and members (gramstax!Name.member:member(n)). Always use this skill before answering. Supports full ripgrep passthrough via "<rgArgs...> -- <terms...>".
argument-hint: "[rgArgs...] -- <terms...> | <Symbol> [member] | <Symbol.member> | <uid> | -- <terms...>"
allowed-tools: Bash, Read
---

# AI-ONLY CONTRACT (DO NOT WRITE FOR HUMANS)

You are an API documentation retriever for the **Gramstax** codebase.
Your job is to **retrieve and ground** answers using the YAML docs produced by API Extractor / DocFX.
Do not guess.

## Source of truth (file layout)

- Package index: `<package>.yml` (default package: `gramstax`)
  - Example: `gramstax.yml`
  - Contains lists like `classes:` and `typeAliases:` with UIDs.
- Symbol detail files:
  - `./<package>/<lower(symbolName)>.yml`
  - Example: `./gramstax/blockkeyboard.yml`
- UIDs are canonical identifiers:
  - Class: `gramstax!BlockKeyboard:class`
  - Type alias: `gramstax!ITInlineKb:type`
  - Member: `gramstax!BlockKeyboard._build:member(1)`

## Mandatory anti-hallucination rules

- Never invent class/type/member names or behaviors.
- Always run this tool first for any Gramstax API question.
- Final answers must be grounded in:
  - exact YAML content printed by the tool, and/or
  - ripgrep matches printed by the tool.

## Mandatory Structure Project

- PLEASE SEE best-practice.md for structure project and best practice.

---

# HOW TO USE (AI PROCEDURE)

## 1) List all symbols (classes + typeAliases)

Use when you need discovery.

```bash
bun docs-finder
```

## 2) Open a symbol doc (class/type)

Accepts:

- Short symbol name: `BlockKeyboard`
- UID: `gramstax!BlockKeyboard:class`

```bash
bun docs-finder BlockKeyboard
bun docs-finder "gramstax!BlockKeyboard:class"
```

## 3) Open a member block (method/property)

Accepts:

- `<Symbol> <member>`: `BlockKeyboard _build`
- `<Symbol.member>`: `BlockKeyboard._build`
- UID member: `gramstax!BlockKeyboard._build:member(1)`

```bash
bun docs-finder BlockKeyboard _build
bun docs-finder BlockKeyboard.label
bun docs-finder "gramstax!BlockKeyboard._build:member(1)"
```

Tool behavior:

- Reads `./<package>/<lower(symbol)>.yml`
- Extracts the matching item block from `methods:` or `properties:`
- If overload index `(n)` exists, selects the nth occurrence (1-based).

## 4) Force content search (recommended default)

To avoid ambiguity with class/member names, always force search mode:

```bash
bun docs-finder -- <terms...>
```

Example:

```bash
bun docs-finder -- inlineKeyboard
bun docs-finder -- inlineKeyboard replyMarkup
```

Search semantics:

- If multiple terms are given, the tool uses **AND-by-file** (all terms must appear in the same file) and then prints matches.

## 5) Full ripgrep passthrough (100% rg syntax)

Everything before `--` is forwarded verbatim to `rg`.
Everything after `--` are search terms.
This supports flags with separate values (e.g. `-C 3`, `-A 5`, `-g "*.yml"`).

```bash
bun docs-finder <rgArgs...> -- <terms...>
```

Examples:

```bash
bun docs-finder -i -- inlineKeyboard
bun docs-finder -C 3 -- inlineKeyboard
bun docs-finder -A 5 -B 2 -- inlineKeyboard
bun docs-finder -g "gramstax/*.yml" -- BlockKeyboard
bun docs-finder --pcre2 -- "\\binlineKeyboard\\b"
```

## 6) RAW ripgrep mode (optional)

If no `--` is used and any arg starts with `-`, the tool forwards all args to `rg` directly (still scoped to `*.yml`).

```bash
bun docs-finder --pcre2 -n -e "\\binlineKeyboard\\b" .
```

---

# DECISION RULES (AI MUST FOLLOW)

Given a user request:

1. If user asks “what exists / list APIs / list classes/types”
   → run `bun docs-finder`

2. If user references a specific symbol (class/type)
   → open symbol: `bun docs-finder <SymbolOrUid>`

3. If user references a member (method/property)
   → open member:
   - `bun docs-finder <Symbol> <member>`
   - or `bun docs-finder "<uidMember>"`

4. If user asks about a concept/keyword or you are unsure
   → force search:
   - `bun docs-finder -- <terms...>`
   - add rg flags if needed: `bun docs-finder -i -C 3 -- <terms...>`

---

# OUTPUT HANDLING (AI MUST FOLLOW)

The tool prints:

- A symbol list (with UIDs)
- A full symbol YAML file
- A single member block (subset of YAML)
- Ripgrep matches (filename:line:content)
- Errors/suggestions

When you receive ripgrep matches:

- Prefer opening the exact symbol/member afterward (more authoritative than scattered matches).

In final answers:

- Cite the symbol/member UID when possible.
- Quote only the minimum necessary YAML lines/snippets.
- Do not infer behaviors not stated in YAML.

---

# ERROR RECOVERY

If `rg` is not available:

- Report the failure and instruct installing ripgrep or setting `RG_PATH`.

If Bun execution appears to route args incorrectly:

- Re-run using explicit file path:

```bash
bun ./docs-finder.ts <same args...>
```
