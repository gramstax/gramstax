# pages-naming

Kebab-case files, parent-child routes, `sN` base ids, `bi`/`kb`/`da` shorthands — everywhere, no exceptions.

## Why

Routing derives from file paths and base ids; inconsistent names produce unfindable routes and unreadable diffs. Shorthands keep handler signatures uniform so `kb`/`da`/`bi` always mean the same thing.

## Incorrect

```typescript
// src/pages/AdminList.ts + AGBaseId + keyboardMarkup
await ctx.edit(keyboardMarkup, templateData, AGBaseId)
```

## Correct

```typescript
// src/pages/admin-list.ts
const bi = Base.step1
const da = {amount: 100}
const kb = this.helper.kb(bi)
await ctx.edit(kb, da, bi)
```

## Notes

- Files: `kebab-case` only (`admin-list-detail.ts` = grandchild of `admin-list.ts`); base ids `s1`, `s1-form`, `s1-success`; single-base pages omit `id` and use `gdefault`.
- Base ids live as statics in an internal `class Base` for type-safe referencing (`id="${Base.step1}"`).
- Shorthands are mandatory in handlers: `bi` (base id), `kb` (keyboard), `da` (template data).

## Directory-Index Style (Deep Trees)

For deep hierarchies (see `example/1-complex/src/pages/start/`), use folders with `index.ts` instead of long hyphen chains — the folder's `index.ts` owns the parent route:

```
src/pages/
├── start/
│   ├── index.ts          # route `start`
│   ├── counter/
│   │   ├── index.ts      # route `start/counter`
│   │   └── thread.ts     # route `start/counter/thread`
│   └── input/
│       └── text/
│           ├── index.ts  # route `start/input/text`
│           └── 2.ts      # route `start/input/text/2`
```

Rules:

- `admin/index.ts` → route `admin`; `admin/ban.ts` → route `admin/ban` (arbitrary depth).
- Never mix both for one route: `sub.ts` + `sub/index.ts` is a duplicate-route error — pick flat file OR folder index.
- A root-level `index.ts` has no parent route and is rejected — rename it to a named file (e.g. `start.ts`).
- e2e mirrors the tree: `start/counter/index.ts` → `e2e/start/counter/index.test.ts`.
- Sibling page classes import each other relatively (`./counter`, `./block/import`); each file owns exactly one route.
