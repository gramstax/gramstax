---
title: Architecture decisions
description: The records behind the choices in this framework, and what each one cost.
icon: list
---

# Architecture decisions

Each ADR records a decision, the alternatives that were considered, and what the
choice costs. They are numbered in the order they were taken, and none of them
are secret. The reasoning is the point.

| Decision |
| --- |
| [ADR-0001: Build on grammY instead of the raw Bot API](/guides/adr/0001-build-on-grammy) |
| [ADR-0002: Template DSL compiled with `new Function()`](/guides/adr/0002-template-dsl-new-function) |
| [ADR-0003: Unified keyv / Redis cache via `CacheExternal`](/guides/adr/0003-keyv-redis-cache) |
| [ADR-0004: Convention-based routing via page class names + `handle*` methods](/guides/adr/0004-convention-routing) |
| [ADR-0005: Hot-reload templates with `chokidar`](/guides/adr/0005-hot-reload-chokidar) |
| [ADR-0006: In-process E2E testing via `deploy: "test"`](/guides/adr/0006-in-process-e2e) |
| [ADR-0007: Bun + tsup + Nx + API-Extractor toolchain](/guides/adr/0007-bun-tsup-nx-toolchain) |
| [ADR-0008: No `@ts-ignore`, named exports only, minimal deps](/guides/adr/0008-lint-export-dep-conventions) |

The lower number is older. If two records disagree, resolve the conflict instead
of keeping both versions.