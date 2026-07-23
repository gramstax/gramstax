# PAGE CLASS STRUCTURE RULES

## Composition Rules

Each page file must follow a strict modular structure. **Only define internal classes if they contain logic or data.** Empty class blocks are prohibited.

| Member            | Purpose             | Convention                                            |
| :---------------- | :------------------ | :---------------------------------------------------- |
| **Base**          | g-base id constants | `static <idName> = \`id\`` inside `class Base`         |
| **UPPER consts**  | Reusable literals   | `const <NAME> = <value>` at top level (below imports) |
| **Helper**        | Local utilities     | `static kb(ctx, bi) { ... }`                          |
| **b\* objects**   | View/process pairs  | `b<name> = { show, [process] }` on Page class         |

## Execution Path (b\* Objects)

Each `<g-base>` block gets a corresponding `b<name>` object field on the exported Page class.

### Naming Convention for b\* Objects

| `<g-base>` config      | `b<name>` to use |
| :--------------------- | :--------------- |
| No `id` attribute      | `bdefault`       |
| Has `id="s1"`          | `bs1`            |
| Has `id="amount"`      | `bamount`        |
| Has `id="warnInvalid"` | `bwarnInvalid`   |

**Rule**: The `b` prefix + the camelCase version of the `id` attribute value. When `id` is omitted (single-base page), always use `bdefault`.

### show / process Methods

- **Form Display**: The `b<name>` object MUST have a `show` method. Name the object after the step (e.g., `bamount`, `bconfirm`, `bsuccess`).
- **Processing (OPTIONAL)**: Add a `process` method when the step expects a text/answer input that must be validated or processed (e.g., a form the user fills in). If `show` has no answer to process, OMIT `process` entirely — do NOT define a `throw ctx` no-op placeholder.
- **Handler Delegation**: Handler methods on the Page class (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`) MUST be thin wrappers containing no core business logic. They route to the appropriate `b<*>.show()` or `b<*>.process()` call.

### Simple pages (single base, no id)

```typescript
export class StartPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show(true);
  }

  async handleCommandText() {
    await this.bdefault.show(false);
  }

  bdefault = {
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
  async handleCallbackQueryData() {
    await this.bamount.show(true)
  }

  async handleSessionFreeText() {
    const {step, amount} = Helper.getSessionParams(this)
    if (step === Base.amount) {
      await this.bamount.process(amount)
    } else if (step === Base.confirm) {
      await this.bconfirm.process()
    }
  }

  bamount = {
    show: async (edit: boolean) => { ... },
    process: async (input: string) => { ... }
  }

  bconfirm = {
    show: async (amount: number) => { ... },
    process: async () => { ... }
  }

  bsuccess = {
    show: async (amount: number, balance: string) => { ... }
  }

  static template = `...`
}
```

## File Ordering (STRICT)

Members within the file **MUST** be declared in this exact order:

1. **Imports**
2. **Base** — internal `class Base` for g-base ID constants (if needed)
3. **UPPER consts** — reusable literals as top-level `const` declarations (if needed) — do **not** wrap these in a class
4. **Helper** — internal class for utility methods (if needed)
5. **Page** — exported class extending PageBase
   a. Handler methods (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`)
   b. `b<*>` object fields
   c. `static template`

## Feedback in b\* Objects

Feedback views (success, error, warning, info) follow the same `b<name>` pattern as step views.

Naming for feedback `b<name>` objects:

| `b<name>`  | Use Case                |
| ---------- | ----------------------- |
| `bsuccess` | Positive outcomes       |
| `bfailed`  | Business logic failures |
| `berror`   | System errors           |
| `bwarn`    | Validation warnings     |
| `binfo`    | Informative content     |
