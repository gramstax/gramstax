# AGENTS.md

## Overview

This document describes the code structure pattern used for project gramstax.

## Project Initialization

**IMPORTANT**: All new Gramstax projects **must** be initialized using the official CLI command:

```bash
npx create-gramstax
```

Do not create project structure manually. Use the CLI to ensure proper scaffolding and configuration.

---

## Toolchain

- Runtime: `bun`.
- Language: `typescript`.
- Bundler: `tsup`.
- Tests: `bun:test`.
- Linting: Eslint config in `.eslint.config.ts` (`eslint` + `typescript-eslint`).
- Formatting: Prettier config in `.prettierrc` (no script provided).
- Type checking: `tsc --noEmit` via `bun run ci:check`.

### Commands

| Command            | Description  |
| ------------------ | ------------ |
| `bun run lint:fix` | Lint and fix |
| `bun run ci:check` | Type check   |

## Page Class Structure

Each page file (`*.ts` in `src/pages/`) follows a consistent structure with up to 4 inner classes:

### 1. Base - Collection of Base ID Strings

Contains **static** string constants used as `<base id="...">` identifiers in templates.

**Note**: This class has no constructor - all members are static.

```typescript
class Base {
  static form = `form`;
  static success = `success`;
  static warnInvalid = `invalid`;
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

### 2. Helper - Collection of Helper Functions

Contains reusable utility functions for building keyboards, formatting data, etc.

**Note**: This class has no constructor - all members are static.

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

### 3. Main - Collection of Main Functions

Contains the primary business logic for the page. Functions follow specific naming patterns.

**Note**: This class has no constructor - all members are static.

#### Naming Conventions

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
      return await Alert.warnInvalid(ctx);
    }
    // ... process the answer
  }
}
```

#### Multi-step Example (create.ts)

```typescript
class Main {
  // Step 1: Display form for title input
  static async showStep1Form(ctx: CreatePage) {
    await ctx.sessionFreeText({ step: `title` });
    const bi = Base.s1;
    const kb = Helper.buildHomeKeyboard(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  // Step 1: Process user's title answer, move to step 2
  static async processStep1Answer(ctx: CreatePage, title: string) {
    await ctx.sessionFreeText({ step: `description`, title });
    await this.showStep2Form(ctx, title);
  }

  // Step 2: Display form for description input
  static async showStep2Form(ctx: CreatePage, title: string) {
    const bi = Base.s2;
    const kb = Helper.buildHomeKeyboard(ctx, bi);
    const da = { title };
    await ctx.reply(kb, da, bi);
  }

  // Step 2: Process description answer, create item
  static async processStep2Answer(ctx: CreatePage, input?: string) {
    // ... create item logic
  }
}
```

---

### 4. Alert - Collection of Alert/Status Messages

Contains functions for displaying user feedback messages (success, warning, error, info).

**Note**: This class has no constructor - all members are static.

#### Naming Conventions

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

## Complete Example

Here's the full structure from `example/6-bank-system/src/pages/deposit.ts`:

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

## Important: Only Create Classes When Used

**Classes should only be defined if they are actually used.** Do not create empty class blocks.

### ❌ Wrong Example

```typescript
// Alert is NOT used but class is still created - WRONG
class Alert {}

class Main {
  static async showStep1Form(ctx: HelpPage) {...}
}

export class HelpPage extends PageBase {...}
```

### ✅ Correct Example

```typescript
// Only Main class is needed, no Base/Helper/Alert
class Alert {
  static async success(ctx: HelpPage) {...}
}

class Main {
  static async showEntryPoint(ctx: HelpPage) {
    ...
    await Alert.success(ctx)
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this);
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
4. Main     (REQUIRED - except for page general-status.ts)
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
class Main {...} // ❌ Main must be at position 4
class Base {...} // ❌ Base must be at position 1
export class Page {...} // ❌ Page must be at position 5
class Alert {...} // ❌ Alert must be at position 3
class Helper {...} // ❌ Helper must be at position 2
```

---

## Variable Naming Conventions

**IMPORTANT**: Use standardized variable names across all page classes for consistency and easy maintenance.

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
// ❌ Wrong: using generic names like 'keyboard', 'data', 'baseId'
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
// Must use bi:
const bi = Base.form;
const kb = Helper.kb(ctx, bi);
const da = { name: value };
await ctx.edit(kb, da, bi);
```

**Don't use `bi` when template has no base ID (default base):**

```typescript
// Template: <base> (without id)
// No need for bi:
const kb = Helper.kb(ctx);
const da = { text: "message" };
await ctx.edit(kb, da);
```

### Base ID Naming for Steps

When using `showStep{N}Form` method, baseId should follow this convention:

**Pattern:** Start with `s` + step number + optional context

| Step Method     | Base ID Examples              | Description                  |
| --------------- | ----------------------------- | ---------------------------- |
| `showStep1Form` | `s1`, `s1Form`, `s1Create`    | Step 1 with optional context |
| `showStep2Form` | `s2`, `s2Confirm`, `s2Review` | Step 2 with optional context |
| `showStep3Form` | `s3`, `s3Complete`            | Step 3 with optional context |

```typescript
class Base {
  static s1 = `s1`; // Simple step 1
  static s1Confirm = `s1-confirm`; // Step 1 with context
  static s2 = `s2`; // Simple step 2
  static s2Review = `s2-review`; // Step 2 with context
}
```

---

## Linting Rules

All code **must** pass linting checks before committing. Run the following commands:

```bash
# Lint and fix
bun run lint:fix

# Type check
bun run ci:check
```

**Linting rules**: Follow `.eslint.config.ts` from the project root.

### NEVER Use eslint-disable

**ILLEGAL** to use `eslint-disable` or any comments to hide errors or warnings.

```typescript
// ❌ ILLEGAL - Never do this:
class Main {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}
```

If there is an error, **fix the code**, don't hide the error.

### Common Linting Rules to Remember

- Use **backtick** quotes for strings (`` ` ``), not single or double quotes
- No unused variables (remove or use all declared variables)
- No spaces inside object braces: `{foo}`, not `{ foo }`
- No semicolons at end of statements
- Use `2` spaces for indentation
- `arrowParens: always` - always use parentheses around arrow function parameters

---

## Summary Table

| Class      | Purpose                                     | Naming Pattern                            | When to Create                                                                                    |
| ---------- | ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Main**   | Business logic (show form / process answer) | `showStep{N}Form`, `processStep{N}Answer` | **Always required** - except for `general-status.ts` (no Main needed)                             |
| **Base**   | Base ID strings for template states         | `static xxx = \`id\``                     | **When needed** - only if template has multiple `<base id="xxx">` states                          |
| **Helper** | Reusable utility functions                  | Any descriptive name                      | **When needed** - only if you have reusable logic used 2+ times                                   |
| **Alert**  | User feedback messages                      | `success*`, `warn*`, `error*`, `info*`    | **When needed** - only if you need to show user feedback (success, error, warning, info messages) |

### Class Creation Guidelines

- **Main** → **ALWAYS REQUIRED**, every page must have a Main class
- **Base** → **WHEN NEEDED**, only when template has >1 `<base id="...">` states
- **Helper** → **WHEN NEEDED**, only when there is reusable logic (usually keyboard builder)
- **Alert** → **WHEN NEEDED**, only when there are user feedback messages with content (success, error, warning, info)

**Minimal example (without Base/Helper/Alert):**

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
