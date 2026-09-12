# PAGE CLASS STRUCTURE RULES

## Composition Rules

Each page file must follow a strict modular structure. **Only define internal classes if they contain logic or data.** Empty class blocks are prohibited.

| Member            | Purpose             | Convention                                            |
| :---------------- | :------------------ | :---------------------------------------------------- |
| **Base**          | g-base id constants | `static <idName> = \`id\`` inside `class Base`         |
| **UPPER consts**  | Reusable literals   | `const <NAME> = <value>` at top level (below imports) |
| **Helper**        | Local utilities     | `static kb(ctx, bi) { ... }`                          |
| **g* objects**   | View/process pairs  | `g<name> = { show, [process] }` on Page class         |

## Execution Path (g* Objects)

Each `<g-base>` block gets a corresponding `g<name>` object field on the exported Page class.

### Naming Convention for g* Objects

| `<g-base>` config      | `g<name>` to use |
| :--------------------- | :--------------- |
| No `id` attribute      | `gdefault`       |
| Has `id="s1"`          | `gs1`            |
| Has `id="amount"`      | `gamount`        |
| Has `id="warnInvalid"` | `gwarnInvalid`   |

**Rule**: The `g` prefix + the camelCase version of the `id` attribute value. When `id` is omitted (single-base page), always use `gdefault`.

### show / process Methods

- **Form Display**: The `g<name>` object MUST have a `show` method. Name the object after the step (e.g., `gamount`, `gconfirm`, `gsuccess`).
- **Processing (OPTIONAL)**: Add a `process` method when the step expects a text/answer input that must be validated or processed (e.g., a form the user fills in). If `show` has no answer to process, OMIT `process` entirely — do NOT define a `throw ctx` no-op placeholder.
- **Handler Delegation**: Handler methods on the Page class (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`) MUST be thin wrappers containing no core business logic. They route to the appropriate `g<*>.show()` or `g<*>.process()` call.

### Simple pages (single base, no id)

```typescript
export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show(true);
  }

  async handleCommandText() {
    await this.gdefault.show(false);
  }

  gdefault = {
    show: async (isEdit = true) => {
      // render logic
    },
  };
}
```

### Multi-step pages (multiple g-base ids)

```typescript
class Base {
  static amount = `s1`
  static confirm = `s2`
  static success = `s`
}

// Reusable literals — use top-level const, NOT a class wrapper
const SOME_TIMEOUT = 5000

class Helper {
  static kb(ctx: DepositPage, bi?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, bi)
  }
}

export class DepositPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gamount.show(true)
  }

  async handleSessionFreeText() {
    const {step, amount} = Helper.getSessionParams(this)
    if (step === Base.amount) {
      await this.gamount.process(amount)
    } else if (step === Base.confirm) {
      await this.gconfirm.process()
    }
  }

  gamount = {
    show: async (edit: boolean) => { ... },
    process: async (input: string) => { ... }
  }

  gconfirm = {
    show: async (amount: number) => { ... },
    process: async () => { ... }
  }

  gsuccess = {
    show: async (amount: number, balance: string) => { ... }
  }

  static template = `...`
}
```

## `static data` — Required (Type Safety)

Every page class **MUST** define `static data = this.buildData(...)`. This enables strict TypeScript checking on `callbackQueryData` calls:

| `buildData` signature | `callbackQueryData` behavior |
| --------------------- | ---------------------------- |
| `buildData()` | `callbackQueryData(): string` — calling with args = TypeScript error |
| `buildData((a: string, b: string) => [a, b])` | `callbackQueryData(a: string, b: string): string` — required args |
| `buildData((a?: string) => [a])` | `callbackQueryData(a?: string): string` — optional args |

Pages without `static data` will **not** have `callbackQueryData` available at all — TypeScript errors on access.

## File Ordering (STRICT)

Members within the file **MUST** be declared in this exact order:

1. **Imports**
2. **Base** — internal `class Base` for g-base ID constants (if needed)
3. **UPPER consts** — reusable literals as top-level `const` declarations (if needed) — do **not** wrap these in a class
4. **Helper** — internal class for utility methods (if needed)
5. **Page** — exported class extending PageBase
   a. `static data = this.buildData(...)` — always first (type safety)
   b. Handler methods (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`)
   c. `g<*>` object fields
   d. `static template`

## Feedback in g* Objects

Feedback views (success, error, warning, info) follow the same `g<name>` pattern as step views.

Naming for feedback `g<name>` objects:

| `g<name>`  | Use Case                |
| ---------- | ----------------------- |
| `gsuccess` | Positive outcomes       |
| `gfailed`  | Business logic failures |
| `gerror`   | System errors           |
| `gwarn`    | Validation warnings     |
| `ginfo`    | Informative content     |
