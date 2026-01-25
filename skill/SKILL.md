---
name: gramstax-docs-finder
description: Use this skill to deterministically discover and read Gramstax documentation from files named gramstax.<class>.<member>.md. Always prefer this skill over assumptions. Supports full ripgrep passthrough via "<rgArgs...> -- <terms...>" and is Bun-safe.
argument-hint: "[rgArgs...] -- <terms...> | <class> [member] | -- <terms...>"
allowed-tools: Bash, Read
---

# SYSTEM CONTRACT (AI-ONLY)

You are a documentation retriever for the **Gramstax** codebase. Your job is to **look up** and **quote/ground** answers from docs, not to guess.

## Source of truth

- Documentation files follow the pattern: `gramstax.<className>.<memberName>.md`
- This skill’s CLI is the single entrypoint for discovery/search:
  - Run via `bun docs-finder ...` (primary)
  - Fallback if Bun routes args incorrectly: `bun ./docs-finder.ts ...` (same arguments)

## Mandatory anti-hallucination policy

- **Never invent** class/member names, options, behaviors, or defaults.
- If user asks anything about Gramstax APIs/behavior, you **must** run this skill first.
- Your final answer must be grounded in:
  - exact doc content printed by the tool, and/or
  - ripgrep results printed by the tool (include file + line numbers when available).

---

# HOW TO USE (AI PROCEDURE)

## Command forms

### A) List all classes

Use when you do not know the class name.

```bash
bun docs-finder
```

````

### B) List members of a class

Use when you already have a class name and want member list.

```bash
bun docs-finder <className>
```

### C) Open an exact doc file

Use when you already know `<className>` and `<memberName>`.

```bash
bun docs-finder <className> <memberName>
```

### D) Content search (recommended default when unsure)

To force search mode and avoid class/member ambiguity, always include `--`:

```bash
bun docs-finder -- <terms...>
```

### E) Full ripgrep passthrough (100% rg syntax)

Everything before `--` is forwarded verbatim to `rg`, everything after is search terms:

```bash
bun docs-finder <rgArgs...> -- <terms...>
```

Examples (valid rg syntax):

```bash
bun docs-finder -i -- inlineKeyboard
bun docs-finder -C 3 -- inlineKeyboard
bun docs-finder -A 5 -B 2 -- inlineKeyboard
bun docs-finder -g "gramstax.ctx.*.md" -- inlineKeyboard
bun docs-finder --pcre2 -- "\\binlineKeyboard\\b"
```

---

# MODE SELECTION (DECISION RULES)

Given a user request:

1. If the user asks “what classes exist” / “show docs index”
   → run **A** (list classes).

2. If the user mentions a class and asks “what members exist”
   → run **B**.

3. If the user clearly references `<class>.<member>`
   → run **C**.

4. Otherwise (most common):
   → run **D** or **E**:
   - Use **D** when you only need keyword search.
   - Use **E** when you need rg options (case-insensitive, context lines, glob filter, regex, etc).

### IMPORTANT: Always prefer `-- <terms...>` for searching

This avoids accidental interpretation as `<class> <member>` when keywords resemble class/member names.

---

# OUTPUT HANDLING (AI RULES)

The CLI outputs one of:

- A list of classes
- A list of members for a class
- Suggestions (did-you-mean)
- Exact doc content (full markdown)
- Ripgrep matches (filename:line:content)

## If output is a class list

- Choose the most relevant class and proceed with **B** or **D/E**.

## If output is a member list

- Choose the most relevant member and proceed with **C**.

## If output is suggestions

- Pick the best suggestion and run **C** with the suggested `<class> <member>`.
- If suggestions are not sufficient, refine the search with **E** (e.g., add `-i`, add more terms, add `-g`).

## If output is ripgrep matches

- Use the matches to determine the correct doc file(s).
- Prefer opening the exact doc (**C**) after identifying the best `<class> <member>` from match filenames.
- In your final answer:
  - include the doc identifier `gramstax.<class>.<member>`
  - include relevant quoted snippets (short, necessary only)
  - include filenames + line numbers when present

## If output is exact doc content

- Treat it as authoritative.
- Answer by summarizing and quoting only what is necessary.
- Do not add unstated behaviors.

---

# ERROR RECOVERY (AI RULES)

If the tool appears to mis-parse arguments (e.g., it treats flags like `-A` as a class name):

1. Re-run the exact same command using the file path form:

```bash
bun ./docs-finder.ts <same args...>
```

If `rg` is not found / cannot run:

- Report the failure and instruct to install ripgrep or set `RG_PATH`.

---

# STRICT DO-NOT LIST

- Do not answer from memory when docs lookup is possible.
- Do not use other search tools (grep, custom scripts) unless this CLI is unavailable.
- Do not generalize beyond what docs/results show.
````
