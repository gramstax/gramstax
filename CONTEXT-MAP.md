# Context Map

Each context has its own `CONTEXT.md` (glossary + domain notes, populated lazily by `/domain-modeling`). ADRs live in `docs/adr/` (system-wide) and `packages/<context>/docs/adr/` (per-context).

| Context | CONTEXT.md | Scope |
|---|---|---|
| gramstax | `packages/gramstax/CONTEXT.md` | Core library: template engine, bot core, pages, cache, blocks |
| lmdb | `packages/lmdb/CONTEXT.md` | LMDB-backed database, OOP repository pattern |
| worker-thread | `packages/worker-thread/CONTEXT.md` | Worker lifecycle, RPC, Unix-socket gateway |
| create-gramstax | `packages/create-gramstax/CONTEXT.md` | CLI scaffolding tool + project templates |
