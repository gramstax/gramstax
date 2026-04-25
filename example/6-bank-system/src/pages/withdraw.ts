import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static form = `form`
  static success = `success`
  static insufficient = `insufficient`
  static invalid = `invalid`
}

class Helper {
  static kb(ctx: WithdrawPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Flow {
  static async enter(ctx: WithdrawPage) {
    await ctx.sessionFreeText()
    const bi = Base.form
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async process(ctx: WithdrawPage) {
    const amountInput = ctx.msgText.trim()
    if (!amountInput) {
      return await Alert.invalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.invalid(ctx, amountInput)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Alert.insufficient(ctx, ctx.bankStore.formatAmount(current))
    }

    const next = current - amount
    const amountHex = ctx.bankStore.toHex(amount)
    ctx.bankStore.setBalance(ctx.userId, next)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `withdraw`,
      amountHex,
      ts: Date.now()
    })

    await ctx.clearSession()
    await Alert.success(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(next))
  }
}

class Alert {
  static async success(ctx: WithdrawPage, amount: string, balance: string, edit = false) {
    const bi = Base.success
    const da = {amount, balance}
    const kb = Helper.kb(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async insufficient(ctx: WithdrawPage, balance: string) {
    const bi = Base.insufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async invalid(ctx: WithdrawPage, amount = ``) {
    const bi = Base.invalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }
}

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  static BASE = Base

  async handleCallbackData() {
    await Flow.enter(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Flow.process(this)
  }

  static template = `
    <base id="form">
      ${this.kbk.cancel()}
      <message>
        ➖ Withdraw funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 50.000
      </message>
    </base>

    <base id="success">
      ${this.kbk.home()}
      <message>
        ✅ Withdrawal completed

        Amount withdrawn: {{amount}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid amount

        We couldn't read: "{{amount}}".
        Please enter a whole number only.
      </message>
    </base>
  `
}
