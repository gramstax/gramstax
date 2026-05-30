# REFERENCE EXAMPLES

## Fully Compliant Page Implementation

This example serves as the "Gold Standard" for Gramstax development. It incorporates all structural, naming, and rendering rules.

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

// 1. BASE ID CONSTANTS
class Base {
  static step1 = `s1`;
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

// 4. ALERTS (User Feedback)
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

// 5. MAIN LOGIC
class Main {
  static async showStep1Form(ctx: DepositPage) {
    await ctx.setSessionFreeText();
    const bi = Base.step1;
    const kb = Helper.kb(ctx, bi);
    const da = {};
    await ctx.edit(kb, da, bi);
  }

  static async processStep1Answer(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim();
    if (!amountInput) {
      return await Alert.showWarnInvalid(ctx);
    }

    // Core business logic here...
    const newBalance = `500`;
    await Alert.showSuccess(ctx, amountInput, newBalance);
  }
}

// 6. EXPORTED PAGE CLASS
export class DepositPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this);
  }

  async handleSessionFreeText() {
    await Main.processStep1Answer(this);
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.cancel()}
      <message>
        ➕ Deposit funds
        Please enter the amount you wish to deposit.
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Deposit completed
        * Amount: {{amount}}
        * Balance: {{balance}}
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid amount
        Please enter a numeric value greater than 0.
      </message>
    </base>
  `;
}
```
