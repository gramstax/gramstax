# REFERENCE EXAMPLES

## Fully Compliant Page Implementation

This example serves as the "Gold Standard" for Gramstax development. It incorporates all structural, naming, and rendering rules.

### Simple Page (single base, no id)

```typescript
import { PageBase } from "~/base/page";
import { HelpPage } from "./help";

export class StartPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show(true);
  }

  async handleCommandText() {
    await this.bdefault.show(false);
  }

  bdefault = {
    show: async (isEdit = true) => {
      await this.clearSession();
      const kb = this.inlineKeyboardT([HelpPage], `1`);
      const da = { userName: this.from?.username };
      if (isEdit) {
        await this.editRich(kb, da);
      } else {
        await this.replyRich(kb, da);
      }
    },
  };

  static template = `
    <g-base>
      <g-keyboard type="inline">🆘 Help</g-keyboard>
      <g-message>
        <b>👋 Welcome {{userName}}</b>
        This is a simple one-screen page.
      </g-message>
    </g-base>
  `;
}
```

### Multi-Step Page (multiple g-base ids)

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

// 1. BASE ID CONSTANTS
class Base {
  static amount = `s1`;
  static confirm = `s2`;
  static success = `s`;
  static warnInvalid = `w-invalid`;
}

// 2. CONSTANTS (If any)

// 3. HELPERS (Keyboards, Formatters, Session helpers)
class Helper {
  static getSessionParams(ctx: DepositPage) {
    return (
      (ctx.temp.session?.params as
        | { step?: string; amount?: number }
        | undefined) ?? {}
    );
  }

  static kb(ctx: DepositPage, bi?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, bi);
  }
}

// 4. EXPORTED PAGE CLASS
export class DepositPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bamount.show(true);
  }

  async handleSessionFreeText() {
    const { step, amount } = Helper.getSessionParams(this);
    if (step === Base.amount) {
      await this.bamount.process(amount);
    } else if (step === Base.confirm) {
      await this.bconfirm.process();
    }
  }

  bamount = {
    show: async (edit: boolean) => {
      await this.setSessionFreeText();
      const bi = Base.amount;
      const kb = Helper.kb(this, bi);
      await this.edit(kb, {}, bi);
    },
    // processAmount is defined because showAmount expects a text answer.
    // If a b<name>.show had no answer to process, OMIT process entirely.
    process: async (amountInput: string) => {
      if (!amountInput) {
        return await this.bwarnInvalid.show();
      }
      // Core business logic here...
      const newBalance = `500`;
      await this.bsuccess.show(amountInput, newBalance);
    },
  };

  bconfirm = {
    show: async (amount: number) => {
      await this.setSessionFreeText({ step: Base.confirm, amount });
      const bi = Base.confirm;
      const kb = Helper.kb(this, bi);
      await this.edit(kb, { amount }, bi);
    },
    process: async () => {
      // confirm logic
    },
  };

  // Feedback objects at the bottom (after all step b* objects)
  bsuccess = {
    show: async (amount: string, balance: string) => {
      const bi = Base.success;
      const da = { amount, balance };
      const kb = Helper.kb(this, bi);
      await this.reply(kb, da, bi);
    },
  };

  bwarnInvalid = {
    show: async (amount = ``) => {
      const bi = Base.warnInvalid;
      const kb = Helper.kb(this, bi);
      const da = { amount };
      await this.reply(kb, da, bi);
    },
  };

  static template = `
    <g-base id="${Base.amount}">
      ${this.kbk.cancel()}
      <g-message>
        ➕ Deposit funds
        Please enter the amount you wish to deposit.
      </g-message>
    </g-base>

    <g-base id="${Base.confirm}">
      ${this.kbk.home()}
      <g-message>
        ✅ Confirm deposit of {{amount}}
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
