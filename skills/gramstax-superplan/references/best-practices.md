# Best-Practice Skill Routing

`gramstax-superplan` should not duplicate the framework's rule sets. Load the relevant best-practice skill as planning input, then write the app-specific plan.

## Routing Table

| Work surface | Load | Why |
| --- | --- | --- |
| Pages, base classes, guards, keyboards, templates, config, e2e, deploy, cache | `gramstax-best-practices` | The main app rule router: config boot, pages, templates/AOT, keyboards, guards, e2e, deploy modes |
| `@gramstax/lmdb`, `src/db`, schemas, indexes, transactions, queues, migrations, backups | `lmdb-best-practices` | Storage-specific performance and correctness rules |
| `@gramstax/worker-thread`, `src/workers`, `src/jobs`, RPC, gateway, pool | `worker-thread-best-practices` | Worker lifecycle, typed dispatch, gateway security, reliability, and bench rules |

Always start with `gramstax-best-practices` for a normal app page/template/config change. Add the LMDB or worker skill only when that surface is actually involved.

## Where To Find Them

In the Gramstax repository:

- `skills/gramstax-best-practices/SKILL.md`
- `skills/lmdb-best-practices/SKILL.md`
- `skills/worker-thread-best-practices/SKILL.md`

On GitHub:

- `https://github.com/gramstax/gramstax/blob/main/skills/gramstax-best-practices/SKILL.md`
- `https://github.com/gramstax/gramstax/blob/main/skills/lmdb-best-practices/SKILL.md`
- `https://github.com/gramstax/gramstax/blob/main/skills/worker-thread-best-practices/SKILL.md`

If the app's agent already has these skills, load them directly. If not, read the linked `SKILL.md` and its relevant `references/` file. For a fully portable setup, copy the three best-practice skill directories into the app's `skills/` directory alongside `gramstax-superplan`.

If the app pins an older Gramstax/LMDB/worker version, prefer the installed package README and version-specific behavior. The current framework `main` rules may describe APIs that do not exist in the app.

## What To Record In The Plan

Add a small table to the plan's findings:

| Skill | Loaded? | Relevant section |
| --- | --- | --- |
| `gramstax-best-practices` | yes | `route-render-api.md`, `pages-base-classes.md` |
| `lmdb-best-practices` | yes/no | `schema-*`, `query-*` |
| `worker-thread-best-practices` | yes/no | `rpc-*`, `lifecycle-*` |

Record only the sections actually used. Do not paste the whole rule set into the plan.

## Greenfield Order

1. Load `gramstax-best-practices` before choosing scaffold options and the first page flow.
2. Scaffold with `create-gramstax`.
3. Verify the generated baseline.
4. Load `lmdb-best-practices` if LMDB was kept.
5. Load `worker-thread-best-practices` if worker threads were kept.
6. Write the first real page flow and its e2e mirror.

## Anti-Patterns

- Planning a page/template change without reading `gramstax-best-practices`.
- Loading LMDB rules for a template-only change.
- Loading worker rules when no worker package is installed.
- Treating current `main` rules as valid for a pinned older app.
- Pasting whole rule files into the plan instead of citing the relevant section.
