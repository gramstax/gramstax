# AGENTS.md

## Overview

This document describes the code structure patterns and best practices for Gramstax projects.

---

## Project Initialization

**IMPORTANT**: All new Gramstax projects **must** be initialized using the official CLI:

```bash
npx create-gramstax@latest
```

Do not create project structure manually. Use the CLI to ensure proper scaffolding and configuration.

### Project Structure

- `src/base` - shared base classes (`guard.ts`, `page.ts`).
- `src/blocks` - template block helpers (`keyboard.ts`).
- `src/core` - runtime entry points (`bot.ts`, `ctx.ts`).
- `src/guards` - guard checks.
- `src/helpers` - Helper function (`log.ts`)
- `src/pages` - page handlers (`start.ts`, `general-status.ts`).
- `src/utils` - raw utility (`array.ts`).
- Optional: `src/db`, `src/repositories`, `src/services`.

---

## Toolchain

- Runtime: `bun`
- Language: `typescript`
- Bundler: `tsup`
- Tests: `bun:test`
- Linting: `eslint` + `typescript-eslint` (`.eslint.config.ts`)
- Formatting: `prettier` (`.prettierrc`)
- Type checking: `tsc --noEmit` via `bun run ci:check`

| Command            | Description  |
| ------------------ | ------------ |
| `bun run lint:fix` | Lint and fix |
| `bun run ci:check` | Type check   |
| `bun run test`     | Run tests    |

---

## Routing and Flow

- Do not write template blocks (e.g., `<b>`) in function classes.
- Do not write content data (e.g., "Your Balance: ...") in function classes (except for a few things).
- If using `this.buildData`, the code must be at the top (position 1).
- Prefer inline keyboard navigation and session flows.
- Avoid slash commands when the flow can be fully inline + session driven.
- Include a `start.ts` page in each example.
- Use the `handleCommandText` route function for the start page.
- Always clear the session on the start page.
- Do not call `getSession()` inside page handlers; the system fetches session before routing.
- Prefer class or static methods for project logic.

---

## Production Quality

- All Gramstax implementations and app code must be production quality.
- Apply production best practices for SQL databases (e.g., PostgreSQL) and NoSQL databases (e.g., LMDB).

---

## Templates and Conditional Rendering

- Use `{~..~}`, `<switch>`, or `<script>` for conditional content inside templates.
- Keep conditional view logic in templates rather than handler functions.
- Do not write multi-language content in page functions; keep it in templates.
- Avoid separate base blocks when only small parts differ; merge and use template conditionals.
- Avoid inline error strings in handlers; render via template conditional or a base variant.
- Do not use `+` inside `{~..~}` and `<script></script>`; use template literals or other non-`+` composition.
- When using template literals inside `{~..~}`, escape backticks and `${}`.
- **IMPORTANT**: Always use `\\n` (double slash) when declaring in template string.
- Use at least a heading + content format for message blocks.
- Pass template data into `inlineKeyboardT`, `inlineKeyboard`, `bottomKeyboardT`, and `bottomKeyboard` when keyboard labels depend on template data.
- Write production-level message content by default (clear, contextual, user-friendly).
- Use production-level emojis in messages (intentional, consistent, aligned with content).
- Adjust emoji placement to lead headings or highlight key actions without overusing.

---

## Keyboard Blocks (this.kbk)

- Only define `this.kbk` blocks when reused by more than one page.
- Do not define a `this.kbk` block for a single page.
- Keyboard labels should be production-ready and short.
- Use production-level emojis in keyboard labels; place them consistently (e.g., leading the label).

---

## Keyboard Labels (this.kbl)

- Use `this.kbl` when keyboard labels are required by more than one page.
- Use `this.kbl` when the same labels are used across multiple base blocks in a page.
- You can combine multiple labels into one `this.kbl` variable (e.g., `cancelHome`).

---

## Base Blocks

- Do not use base IDs if a page has only one base block.
- If two base blocks can be combined without IDs, combine them.
- Use base IDs only when multiple distinct base blocks are required.

---

## Label Reuse and Duplication

- Avoid duplicate values inside `KeyboardBlock.label`.
- When a label combines other labels, derive it using `this.<key>` instead of literal duplication.
- Define derived labels after their dependencies to avoid "used before initialization" errors.

---

## Page Class Structure

Each page file (`*.ts` in `src/pages/`) follows a consistent structure with up to **4 inner classes**. Define only what you need — never create empty class blocks.

| Class      | Purpose                                                                            | Required                                            |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Main**   | Business logic (`showStep{N}Form` / `processStep{N}Answer` / `showIndex`)          | **Always required** (except `general-status.ts`)    |
| **Base**   | Base ID strings for template states                                                | When template has multiple `<base id="...">` states |
| **Helper** | Reusable utility functions (keyboard builders, formatters)                         | When reusable logic appears 2+ times                |
| **Alert**  | User feedback messages (showSuccess, showFailed, showError, showWarning, showInfo) | When user feedback with content is needed           |

### 1. Base - Base ID Constants

Contains **static** string constants used as `<base id="...">` identifiers in templates.

```typescript
class Base {
  static form = `form`;
  static success = `success`;
  static warnInvalid = `warn-invalid`;
}
```

**Purpose**: Define unique identifiers for different states/views within a single page.

**Usage in template**:

```typescript
static template = `
  <base id="${Base.form}">
    <!-- form content -->
  </base>

  <base id="${Base.success}">
    <!-- success content -->
  </base>
`
```

---

### 2. Helper - Utility Functions

Contains reusable utility functions for building keyboards, formatting data, etc.

```typescript
class Helper {
  static kb(ctx: DepositPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId);
  }

  static getSessionParams(ctx: CreatePage) {
    return (ctx.temp.session?.params as CreateSessionParams | undefined) ?? {};
  }
}
```

**Purpose**: Avoid code duplication by centralizing common UI/logic operations.

---

### 3. Main - Business Logic

Contains the primary business logic for the page. Functions follow specific naming patterns.

| Type                 | Pattern                     | Example                                    |
| -------------------- | --------------------------- | ------------------------------------------ |
| **Form (display)**   | `showStep{Number}Form`      | `showStep1Form`, `showStep2Form`           |
| **Answer (process)** | `processStep{Number}Answer` | `processStep1Answer`, `processStep2Answer` |

**Suffix is mandatory**: `*Form` for displaying forms, `*Answer` for processing user input.

#### Single-step Example (deposit.ts)

```typescript
class Main {
  static async showStep1Form(ctx: DepositPage) {
    await ctx.sessionFreeText();
    const bi = Base.form;
    const kb = Helper.kb(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  static async processStep1Answer(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim();
    if (!amountInput) {
      return await Alert.showWarnInvalid(ctx);
    }
    // ... process the answer
  }
}
```

#### Multi-step Example (create.ts)

```typescript
class Main {
  static async showStep1Form(ctx: CreatePage) {
    await ctx.sessionFreeText({ step: `title` });
    const bi = Base.step1;
    const kb = Helper.buildHomeKeyboard(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  static async processStep1Answer(ctx: CreatePage, title: string) {
    await ctx.sessionFreeText({ step: `description`, title });
    await this.showStep2Form(ctx, title);
  }

  static async showStep2Form(ctx: CreatePage, title: string) {
    const bi = Base.step2;
    const kb = Helper.buildHomeKeyboard(ctx, bi);
    const da = { title };
    await ctx.reply(kb, da, bi);
  }

  static async processStep2Answer(ctx: CreatePage, input?: string) {
    // ... create item logic
  }
}
```

---

### 4. Alert - User Feedback

Contains functions for displaying user feedback messages (success, failed, error, warning, info).

| Type        | Pattern        | Example                                        |
| ----------- | -------------- | ---------------------------------------------- |
| **Success** | `showSuccess*` | `showSuccess(ctx, data)`                       |
| **Failed**  | `showFailed*`  | `showFailed(ctx)`                              |
| **Error**   | `showError*`   | `showErrorNotFound(ctx)`                       |
| **Warning** | `showWarn*`    | `showWarnInvalid(ctx)`, `showWarnExisted(ctx)` |
| **Info**    | `showInfo*`    | `showInfoHelp(ctx)`                            |

```typescript
class Alert {
  static async showSuccess(ctx: DepositPage, amount: string, balance: string) {
    const bi = Base.success;
    const da = { amount, balance };
    const kb = Helper.kb(ctx, bi);
    await ctx.reply(kb, da, bi);
  }

  static async showWarnInvalid(ctx: DepositPage, amount = ``) {
    const bi = Base.warnInvalid;
    const kb = Helper.kb(ctx, bi);
    const da = { amount };
    await ctx.reply(kb, da, bi);
  }
}
```

---

## Only Create Classes When Used

**Classes should only be defined if they are actually used.** Do not create empty class blocks.

### ❌ Wrong Example

```typescript
class Alert {} // Alert is NOT used but class is still created - WRONG

class Main {
  static async showStep1Form(ctx: HelpPage) {...}
}

export class HelpPage extends PageBase {...}
```

### ✅ Correct Example

```typescript
class Alert {
  static async showSuccess(ctx: HelpPage) {...}
}

class Main {
  static async showIndex(ctx: HelpPage) {
    // condition code
    await Alert.showSuccess(ctx)
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this);
  }
}
```

---

## Class Order in Page Files

Classes in page files must be ordered as follows:

```
1. Base     (if needed)
2. Helper   (if needed)
3. Alert    (if needed)
4. Main     (REQUIRED - except for general-status.ts)
5. *Page    (export class - REQUIRED)
```

```typescript
// ✅ Correct - Class order follows the rules
class Base {...}
class Helper {...}
class Alert {...}
class Main {...}
export class DepositPage extends PageBase {...}
```

```typescript
// ❌ Wrong - Class order does not follow rules
class Main {...}      // ❌ Must be at position 4
class Base {...}      // ❌ Must be at position 1
export class Page {...} // ❌ Must be at position 5
class Alert {...}     // ❌ Must be at position 3
class Helper {...}    // ❌ Must be at position 2
```

---

## Variable Naming Conventions

Use standardized variable names for consistency and easy maintenance.

| Variable | Purpose           | Example                         |
| -------- | ----------------- | ------------------------------- |
| `kb`     | Keyboard markup   | `const kb = Helper.kb(ctx, bi)` |
| `da`     | Data for template | `const da = { name: value }`    |
| `bi`     | Base ID string    | `const bi = Base.form`          |

### ✅ Correct Usage

```typescript
static async showStep1Form(ctx: DepositPage) {
  const bi = Base.form; // ✅ bi for base id
  const kb = Helper.kb(ctx, bi); // ✅ kb for keyboard
  const da = {}; // ✅ da for data
  await ctx.edit(kb, da, bi);
}
```

### ❌ Wrong Usage

```typescript
static async showStep1Form(ctx: DepositPage) {
  const baseId = Base.form           // ❌ should be 'bi'
  const keyboard = Helper.kb(ctx)   // ❌ should be 'kb'
  const data = {}                   // ❌ should be 'da'
  await ctx.edit(keyboard, data, baseId)
}
```

### When to Use `bi` (Base ID)

**Use `bi` when template has explicit base ID:**

```typescript
// Template: <base id="${Base.form}">
const bi = Base.form;
const kb = Helper.kb(ctx, bi);
const da = { name: value };
await ctx.edit(kb, da, bi);
```

**Don't use `bi` when template has no base ID (default base):**

```typescript
// Template: <base> (without id)
const kb = Helper.kb(ctx);
const da = { text: "message" };
await ctx.edit(kb, da);
```

### Base ID Naming for Steps

When using `showStep{N}Form` method, baseId should follow this convention: start with `s` + step number + optional context.

| Step Method     | Base ID Key Examples                   | Description                  |
| --------------- | -------------------------------------- | ---------------------------- |
| `showStep1Form` | `step1`, `step1Form`, `step1Create`    | Step 1 with optional context |
| `showStep2Form` | `step2`, `step2Confirm`, `step2Review` | Step 2 with optional context |
| `showStep3Form` | `step3`, `step3Complete`               | Step 3 with optional context |

```typescript
class Base {
  static step1 = `s1`;
  static step1Confirm = `s1-confirm`;
  static step2 = `s2`;
  static step2Review = `s2-review`;
}
```

---

## Linting Rules

All code **must** pass linting checks before committing.

### NEVER Use eslint-disable

**ILLEGAL** to use `eslint-disable` or any comments to hide errors or warnings.

```typescript
// ❌ ILLEGAL - Never do this:
class Main {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}
```

If there is an error, **fix the code**, don't hide the error.

### Common Linting Rules

- Use **backtick** quotes for strings (`` ` ``), not single or double quotes
- No unused variables (remove or use all declared variables)
- No spaces inside object braces: `{foo}`, not `{ foo }`
- No semicolons at end of statements
- Use `2` spaces for indentation
- `arrowParens: always` - always use parentheses around arrow function parameters

---

## Complete Example

Full structure from `example/6-bank-system/src/pages/deposit.ts`:

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

class Base {
  static form = `form`;
  static success = `success`;
  static warnInvalid = `invalid`;
}

class Helper {
  static kb(ctx: DepositPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId);
  }
}

class Alert {
  static async showSuccess(ctx: DepositPage, amount: string, balance: string) {
    const bi = Base.success;
    const da = { amount, balance };
    const kb = Helper.kb(ctx, bi);
    await ctx.reply(kb, da, bi);
  }

  static async showWarnInvalid(ctx: DepositPage, amount = ``) {
    const bi = Base.warnInvalid;
    const kb = Helper.kb(ctx, bi);
    const da = { amount };
    await ctx.reply(kb, da, bi);
  }
}

class Main {
  static async showStep1Form(ctx: DepositPage) {
    await ctx.sessionFreeText();
    const bi = Base.form;
    const kb = Helper.kb(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  static async processStep1Answer(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim();
    if (!amountInput) {
      return await Alert.showWarnInvalid(ctx);
    }
    // ... processing logic
    await Alert.showSuccess(ctx, amount, balance);
  }
}

export class DepositPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this);
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null;
    }
    await Main.processStep1Answer(this);
  }

  static template = `
    <base id="${Base.form}">
      ${this.kbk.cancel()}
      <message>
        ➕ Deposit funds
        Enter the amount...
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Deposit completed
        Amount: {{amount}}
        Balance: {{balance}}
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid amount
      </message>
    </base>
  `;
}
```

---

## Summary Table

| Class      | Purpose                                     | Naming Pattern                                                        | When to Create                                                           |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Main**   | Business logic (show form / process answer) | `showStep{N}Form`, `processStep{N}Answer`, `showIndex`                | **Always required** - except for `general-status.ts`                     |
| **Base**   | Base ID strings for template states         | `static xxx = \`id\``                                                 | **When needed** - only if template has multiple `<base id="xxx">` states |
| **Helper** | Reusable utility functions                  | Any descriptive name                                                  | **When needed** - only if reusable logic used 2+ times                   |
| **Alert**  | User feedback messages                      | `showSuccess*`, `showFailed*`, `showError*`, `showWarn*`, `showInfo*` | **When needed** - only if user feedback with content                     |

### Minimal Example (without Base/Helper/Alert)

```typescript
class Base {
  static index = `-`;
}

class Main {
  static async showIndex(ctx: StartPage) {
    const bi = Base.index;
    const kb = ctx.inlineKeyboardT([ctx]);
    const da = { name: ctx.userFirstName, random: Math.random() };
    await ctx.edit(kb, da, bi);
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this);
  }

  static template = `
    <base id="${Base.index}">
      <keyboard>Refresh</keyboard>
      <message>Hello {{name}}, {{random}}</message>
    </base>
  `;
}
```

---

> This AGENTS.md combines best practices from the Gramstax project. Updated with content from `skill/best-practice.md`.
