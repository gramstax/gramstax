---
name: gramstax-best-practice
description: Comprehensive best practices for Gramstax real project structure and page patterns.
---

# Gramstax Best Practices

> Complete guide for building production-quality Gramstax projects.

---

## Table of Contents

1. [Project Structure](#project-structure-official-create-gramstax)
2. [Routing and Flow](#routing-and-flow)
3. [Production Quality](#production-quality-gramstax--app-code)
4. [Templates and Conditional Rendering](#templates-and-conditional-rendering)
5. [Keyboard Blocks](#keyboard-blocks-thiskbk)
6. [Keyboard Labels](#keyboard-labels-thiskbl)
7. [Base Blocks](#base-blocks)
8. [Label Reuse and Duplication](#label-reuse-and-duplication)
9. [Page Class Structure](#page-class-structure)
10. [Variable Naming Conventions](#variable-naming-conventions)
11. [Class Ordering](#class-order-in-page-files)
12. [Linting Rules](#linting-rules)

---

## Project Structure (official create-gramstax)

- Always bootstrap new projects with the `npx create-gramstax@latest` CLI; do not create project files manually.
- `src/base` for shared base classes (`guard.ts`, `page.ts`).
- `src/blocks` for template block helpers (`keyboard.ts`).
- `src/core` for runtime entry points (`bot.ts`, `ctx.ts`).
- `src/guards` for guard checks (`__example.ts` removable once real guards exist).
- `src/pages` for page handlers (`start.ts`, `general-status.ts`).
- `src/utils` for logging and helpers (`log.ts`).
- Optional: `src/db`, `src/repositories`, `src/services`.

---

## Routing and Flow

- Dont write template block (e.g., `<b>`) in function classes.
- Dont write content data (e.g., "Your Balance: ...") in function classes (except for a few things).
- If use `this.buildData` the code must be at top number 1.
- Prefer inline keyboard navigation and session flows.
- Avoid slash commands when the flow can be fully inline + session driven.
- Include a `start.ts` page in each example.
- Use the `handleCommandText` route function for the start page.
- Always clear the session on the start page.
- Do not call `getSession()` inside page handlers; the system fetches session before routing.
- Prefer class or static methods for project logic.

---

## Production Quality (Gramstax + App Code)

- All Gramstax implementations and app code must be production quality.
- Apply best production to SQL databases (e.g., PostgreSQL) and NoSQL databases (e.g., LMDB).

---

## Templates and Conditional Rendering

- Use `{~..~}`, `<switch>`, or `<script>` for conditional content inside templates.
- Keep conditional view logic in templates rather than handler functions.
- Do not write multi-language content in page functions; keep it in templates.
- Avoid separate base blocks when only small parts differ; merge and use template conditionals.
- Avoid inline error strings in handlers; render via template conditional or a base variant.
- Do not use `+` inside `{~..~}` and `<script></script>`; use template literals or other non-`+` composition.
- When using template literals inside `{~..~}`, escape backticks and `${}`.
- **IMPORTANT**: Always use `\\n` (double slash) if declare in template string when used.
- Use at least a heading + content format for message blocks.
- Pass template data into `inlineKeyboardT`, `inlineKeyboard`, `bottomKeyboardT` and `bottomKeyboard` when keyboard labels depend on template data.
- Write production-level message content by default (clear, contextual, user-friendly), not short placeholders.
- Use production-level emojis in messages (intentional, consistent, and aligned with the content).
- Adjust emoji placement to lead headings or highlight key actions without overusing them.

---

## Keyboard Blocks (this.kbk)

- Only define `this.kbk` blocks when the keyboard block is reused by more than one page.
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

Each page file (`*.ts` in `src/pages/`) follows a consistent structure with up to **4 inner classes**. Define only what you need — never create empty classes.

### Class Overview

| Class      | Purpose                                                             | Required                                            |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| **Base**   | Base ID strings for template states                                 | When template has multiple `<base id="...">` states |
| **Helper** | Reusable utility functions (keyboard builders, formatters)          | When reusable logic appears 2+ times                |
| **Alert**  | User feedback messages (success, warning, error, info)              | When user feedback with content is needed           |
| **Main**   | Primary business logic (`showStep{N}Form` / `processStep{N}Answer`) | **Always required** (except `general-status.ts`)    |

---

### 1. Base — Base ID Constants

Defines static string constants for `<base id="...">` identifiers in templates.

```typescript
class Base {
  static form = `form`;
  static success = `success`;
  static warnInvalid = `invalid`;
}
```

**Usage in template:**

```typescript
static template = `
  <base id="${Base.form}">
    <!-- form content -->
  </base>

  <base id="${Base.success}">
    <!-- success content -->
  </base>
`;
```

---

### 2. Helper — Utility Functions

Contains reusable utility functions. No constructor — all members are static.

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

---

### 3. Main — Business Logic

Contains primary business logic with strict naming conventions.

| Type               | Pattern                | Example                                    |
| ------------------ | ---------------------- | ------------------------------------------ |
| **Display Form**   | `showStep{N}Form`      | `showStep1Form`, `showStep2Form`           |
| **Process Answer** | `processStep{N}Answer` | `processStep1Answer`, `processStep2Answer` |

**Single-step Example:**

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
      return await Alert.warnInvalid(ctx);
    }
    // ... process the answer
  }
}
```

**Multi-step Example:**

```typescript
class Main {
  static async showStep1Form(ctx: CreatePage) {
    await ctx.sessionFreeText({ step: `title` });
    const bi = Base.s1;
    const kb = Helper.buildHomeKeyboard(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  static async processStep1Answer(ctx: CreatePage, title: string) {
    await ctx.sessionFreeText({ step: `description`, title });
    await this.showStep2Form(ctx, title);
  }

  static async showStep2Form(ctx: CreatePage, title: string) {
    const bi = Base.s2;
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

### 4. Alert — User Feedback

Displays user feedback messages with consistent naming:

| Type        | Pattern    | Example                                |
| ----------- | ---------- | -------------------------------------- |
| **Success** | `success*` | `success(ctx, data)`                   |
| **Warning** | `warn*`    | `warnInvalid(ctx)`, `warnExisted(ctx)` |
| **Error**   | `error*`   | `errorNotFound(ctx)`                   |
| **Info**    | `info*`    | `infoHelp(ctx)`                        |

```typescript
class Alert {
  static async success(ctx: DepositPage, amount: string, balance: string) {
    const bi = Base.success;
    const da = { amount, balance };
    const kb = Helper.kb(ctx, bi);
    await ctx.reply(kb, da, bi);
  }

  static async warnInvalid(ctx: DepositPage, amount = ``) {
    const bi = Base.warnInvalid;
    const kb = Helper.kb(ctx, bi);
    const da = { amount };
    await ctx.reply(kb, da, bi);
  }
}
```

---

### Complete Example

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
  static async success(ctx: DepositPage, amount: string, balance: string) {
    const bi = Base.success;
    const da = { amount, balance };
    const kb = Helper.kb(ctx, bi);
    await ctx.reply(kb, da, bi);
  }

  static async warnInvalid(ctx: DepositPage, amount = ``) {
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
      return await Alert.warnInvalid(ctx);
    }
    // ... processing logic
    await Alert.success(ctx, amount, balance);
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

## Variable Naming Conventions

Use standardized variable names across all page classes:

| Variable | Purpose           | Example                         |
| -------- | ----------------- | ------------------------------- |
| `kb`     | Keyboard markup   | `const kb = Helper.kb(ctx, bi)` |
| `da`     | Data for template | `const da = { name: value }`    |
| `bi`     | Base ID string    | `const bi = Base.form`          |

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

When using `showStep{N}Form`, baseId follows this pattern:

| Step Method     | Base ID Examples              | Description                  |
| --------------- | ----------------------------- | ---------------------------- |
| `showStep1Form` | `s1`, `s1Form`, `s1Create`    | Step 1 with optional context |
| `showStep2Form` | `s2`, `s2Confirm`, `s2Review` | Step 2 with optional context |
| `showStep3Form` | `s3`, `s3Complete`            | Step 3 with optional context |

```typescript
class Base {
  static s1 = `s1`;
  static s1Confirm = `s1-confirm`;
  static s2 = `s2`;
  static s2Review = `s2-review`;
}
```

---

## Class Order in Page Files

Classes must appear in this specific order:

```
1. Base     (if needed)
2. Helper   (if needed)
3. Alert    (if needed)
4. Main     (REQUIRED - except for general-status.ts)
5. *Page    (export class - REQUIRED)
```

### Correct Order

```typescript
class Base {...}
class Helper {...}
class Alert {...}
class Main {...}
export class DepositPage extends PageBase {...}
```

### Wrong Order

```typescript
class Main {...}      // ❌ Must be position 4
class Base {...}      // ❌ Must be position 1
export class Page {...} // ❌ Must be position 5
class Alert {...}     // ❌ Must be position 3
class Helper {...}    // ❌ Must be position 2
```

---

## Linting Rules

All code **must** pass linting before committing.

### Essential Commands

```bash
bun run lint:fix  # Lint and auto-fix
bun run ci:check # Type checking
bun run test     # Run tests
```

### Never Use eslint-disable

Hiding errors with `eslint-disable` is **illegal**. Fix the code, don't hide the error.

```typescript
// ❌ ILLEGAL
class Main {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}
```

### Key Formatting Rules

- Use **backtick** quotes for strings (`` ` ``), not single or double quotes
- **No unused variables** — remove or use all declared variables
- **No spaces inside object braces**: `{foo}`, not `{ foo }`
- **No semicolons** at end of statements
- Use **2 spaces** for indentation
- **`arrowParens: always`** — always use parentheses around arrow function parameters

---

## Quick Reference

### Class Creation Decision Tree

```
Page file created
       │
       ▼
Need Main class? ──No──► Exception: general-status.ts only
       │ Yes
       ▼
Template has >1 <base id="...">? ──Yes──► Add Base class
       │ No
       ▼
Need reusable logic (2+ times)? ──Yes──► Add Helper class
       │ No
       ▼
Need user feedback messages? ──Yes──► Add Alert class
       │ No
       ▼
Done
```

### Minimal Page Example

```typescript
class Main {
  static async showEntryPoint(ctx: StartPage) {
    const kb = ctx.inlineKeyboardT([ctx]);
    const da = { name: ctx.userFirstName, random: Math.random() };
    await ctx.edit(kb, da);
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showEntryPoint(this);
  }

  static template = `
    <base>
      <keyboard>Refresh</keyboard>
      <message>Hello {{name}}, {{random}}</message>
    </base>
  `;
}
```

---

> **Note:** This guide combines content from `agent/AGENTS.md` and the original skill documentation. Always refer to the source for the most up-to-date patterns.
