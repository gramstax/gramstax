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
const kb = Helper.kb(ctx, bi)
await ctx.edit(kb, da, bi)
```

## Notes

- Files: `kebab-case` only (`admin-list-detail.ts` = grandchild of `admin-list.ts`); base ids `s1`, `s1-form`, `s1-success`; single-base pages omit `id` and use `gdefault`.
- Base ids live as statics in an internal `class Base` for type-safe referencing (`id="${Base.step1}"`).
- Shorthands are mandatory in handlers: `bi` (base id), `kb` (keyboard), `da` (template data).
