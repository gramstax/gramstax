# REFERENCE EXAMPLES

## Fully Compliant Page Implementation

This example serves as the "Gold Standard" for Gramstax development. It incorporates all structural, naming, and rendering rules.

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

// 1. BASE ID CONSTANTS
class Base {
  static amount = `s1`;
  static success = `s`;
  static warnInvalid = `w-invalid`;
}

// 2. CONSTANTS (If any)

// 3. HELPERS (Keyboards, Formatters)
class Helper {
  static kb(ctx: DepositPage, bi?: string) {
    // Note: 'bi' shorthand used for Base ID
    return ctx.inlineKeyboardT([StartPage], `1`, bi);
  }
}

// 4. MAIN LOGIC
class Main {
  static async showAmount(ctx: DepositPage) {
    await ctx.setSessionFreeText();
    const bi = Base.amount;
    const kb = Helper.kb(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  // processAmount is defined because showAmount expects a text answer.
  // If a show{NameBase} method had no answer to process, OMIT process{NameBase}
  // entirely — do NOT add a `throw ctx` placeholder.
  static async processAmount(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim();
    if (!amountInput) {
      return await Main.showWarnInvalid(ctx);
    }

    // Core business logic here...
    const newBalance = `500`;
    await Main.showSuccess(ctx, amountInput, newBalance);
  }

  // Feedback methods at the bottom (after all show{NameBase} / process{NameBase})
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

// 5. EXPORTED PAGE CLASS
export class DepositPage extends PageBase {
  async handleCallbackData() {
    await Main.showAmount(this);
  }

  async handleSessionFreeText() {
    await Main.processAmount(this);
  }

  static template = `
    <g-base id="${Base.amount}">
      ${this.kbk.cancel()}
      <g-message>
        ➕ Deposit funds
        Please enter the amount you wish to deposit.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Deposit completed
        * Amount: {{amount}}
        * Balance: {{balance}}
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid amount
        Please enter a numeric value greater than 0.
      </g-message>
    </g-base>
  `;
}
```
