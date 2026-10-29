---
title: The @gramstax packages
description: The four npm packages this monorepo publishes, what each one owns, and which one to reach for.
icon: package
---

# The @gramstax packages

The monorepo publishes four npm packages that interlock. The core one,
`gramstax`, owns page routing, the template engine, rendering, sessions and the
CLI. Two supporting packages sit beside it and depend on nothing in it, and one
CLI scaffolds a project that can use all three.

| Package | What it does | Install | Monorepo path |
| :--- | :--- | :--- | :--- |
| `gramstax` | Page routing, template engine, render API, session and caching, CLI, mock server, e2e harness | `bun add gramstax` | `packages/gramstax` |
| `@gramstax/lmdb` | Schema-declared LMDB sub-databases, indexes, transactions, queues, change data capture, backups | `bun add @gramstax/lmdb` | `packages/lmdb` |
| `@gramstax/worker-thread` | Worker lifecycle, typed RPC, pools, inter-worker socket gateway | `bun add @gramstax/worker-thread` | `packages/worker-thread` |
| `create-gramstax` | Project scaffolding: the template tree that becomes a new project | `bunx create-gramstax@latest my-bot` | `packages/create-gramstax` |

One workspace version governs all four, and all four are published at `latest`;
the published versions are a matched set. The two supporting packages carry no
dependency on `gramstax`: a worker never touches storage, and a repository never
knows about the bot. `create-gramstax` wires them in behind `--lmdb` and
`--worker-thread`, independently combinable.

## When to reach for which

### `gramstax`

The framework itself. Reach for it when the bot has screens rather than only
handlers, because it owns the shape of the project instead of the calls you
make.

- `gramstax.config.ts` is the single composition point: token, deploy mode, caches, and runtime tuning.
- `src/pages` is the route table. The file path is the route, and a page class is the handler.
- `gramstax start` discovers the pages and runs the bot. Construction is boot, with no hand-written entry file.

### `@gramstax/lmdb`

Persistence. Reach for it when a bot has to remember something across
restarts, because a page is a fresh object per update and the framework
caches are there for hot conversational state.

- Declare a schema class, register it once with `env.register(SchemaClass)`, and get back a typed handle whose methods take no schema argument.
- Indexes, TTL, queues, change data capture, backups, and migrations ride along with the declaration.
- The data stays an LMDB file, so it can be opened with any LMDB client.

### `@gramstax/worker-thread`

Background work. Reach for it when the work should not sit in the update path,
where the user waits for it.

- Write a class, mark the reachable methods with the `mtd` prefix, and call them as if they were local async functions.
- `WorkerThreadExport.init()` derives the client from the worker class, so a renamed method breaks compilation at every call site.
- A socket gateway lets sibling workers talk to each other directly, with the main thread off the hot path.

### `create-gramstax`

Scaffolding. Reach for it at the start of a project.

- It copies a template tree, substitutes the generator placeholders, and prunes whatever the selected feature set does not include.
- The generated project ships pages and an e2e suite that mirrors the page tree, with `e2e/COVERAGE.md` as the handler ledger. `test:e2e:check` runs both the bidirectional mirror check and the ledger audit.
- `--lmdb`, `--worker-thread`, and `--biome` decide which parts survive.
- Generated projects are Bun-only: every app, test, and build script runs through Bun.

## Skills for agents

The repository ships three rule-based skills that a coding agent can load,
each with a `references/` directory holding one file per rule:

- `skills/gramstax-best-practices/SKILL.md`
- `skills/lmdb-best-practices/SKILL.md`
- `skills/worker-thread-best-practices/SKILL.md`

It also ships two plan lifecycle skills:

- `skills/gramstax-superplan/SKILL.md` — portable planning for apps built on
  the Gramstax ecosystem, including greenfield `create-gramstax` scaffolds,
  generated projects, and standalone apps. It routes page/template/config work
  to `gramstax-best-practices` and LMDB/worker work to the matching package
  skill. Copy the folder into the app's `skills/` directory.
- `skills/gramstax-repo-superplan/SKILL.md` — planning for the Gramstax
  framework monorepo itself, including packages and generated documentation.

`create-gramstax` has no package-specific skill of its own. App teams should
copy `gramstax-superplan` plus the three best-practice skills into their
project; framework work uses `gramstax-repo-superplan` and the matching package
`AGENTS.md`.

## Where to go next

- [Getting Started](/guides/getting-started) - install the framework and run a bot locally
- [Routing](/guides/routing) - how an update reaches a page handler
- [Pages](/guides/pages) - the parts of a page class
- [Storage with LMDB](/guides/storage-lmdb) - persisting data across restarts
- [Background work with worker threads](/guides/worker-threads) - moving work off the update path
- [Example bots](/guides/examples) - the runnable projects under `example/`
- [FAQ](/guides/faq) - design questions and known limitations
- [Quickstart](/quickstart) - a guided first bot

## Support and reporting

Bugs and feature requests go to the [issue tracker of the repository](https://github.com/gramstax/gramstax/issues) that hosts
all four packages.
