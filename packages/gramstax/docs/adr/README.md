# Architecture Decision Records

> Significant technical decisions made in `gramstax`, recorded as individual ADRs.

ADRs capture the **context**, **decision**, and **consequences** of choices that shape the project's architecture. They are mined from git history, the `AGENTS.md` guide, dependency choices, and code structure.

## ADR Index

| #                                           | Title                                                             | Status   | Date            |
| ------------------------------------------- | ----------------------------------------------------------------- | -------- | --------------- |
| [0001](0001-build-on-grammy.md)             | Build on grammY instead of the raw Bot API                        | Accepted | 2025 (inferred) |
| [0002](0002-template-dsl-new-function.md)   | Template DSL compiled with `new Function()`                       | Accepted | 2025 (inferred) |
| [0003](0003-keyv-redis-cache.md)            | Unified keyv / Redis cache via `CacheExternal`                    | Accepted | 2025 (inferred) |
| [0004](0004-convention-routing.md)          | Convention-based routing via page class names + `handle*` methods | Accepted | 2025 (inferred) |
| [0005](0005-hot-reload-chokidar.md)         | Hot-reload templates with `chokidar`                              | Accepted | 2025 (inferred) |
| [0006](0006-in-process-e2e.md)              | In-process E2E testing via `deploy:"test"`                        | Accepted | 2025 (inferred) |
| [0007](0007-bun-tsup-nx-toolchain.md)       | Bun + tsup + Nx + API-Extractor toolchain                         | Accepted | 2025 (inferred) |
| [0008](0008-lint-export-dep-conventions.md) | No `@ts-ignore`, named exports only, minimal deps                 | Accepted | 2025 (inferred) |

## Status Definitions

| Status         | Meaning                                       |
| -------------- | --------------------------------------------- |
| **Proposed**   | Under discussion, not yet adopted             |
| **Accepted**   | Active and in effect                          |
| **Superseded** | Replaced by a newer ADR (link to replacement) |
| **Deprecated** | No longer relevant                            |

## Related Documentation

- [Architecture](../architecture.md) - System design context
- [Development](../development.md) - Contributing workflow
- [Overview](../overview.md) - Project purpose and scope
