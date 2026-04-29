import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static form = `form`
  static success = `success`
  static warnInsufficient = `w-insufficient`
  static warnInvalid = `w-invalid`
}

class Helper {
  static kb(ctx: WithdrawPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Main {
  static async showStep1Form(ctx: WithdrawPage) {
    await ctx.sessionFreeText()
    const bi = Base.form
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: WithdrawPage) {
    const amountInput = ctx.msgText.trim()
    if (!amountInput) {
      return await Alert.warnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.warnInvalid(ctx, amountInput)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Alert.warnInsufficient(ctx, ctx.bankStore.formatAmount(current))
    }

    const next = current - amount
    const amountHex = ctx.bankStore.toHex(amount)
    ctx.bankStore.setBalance(ctx.userId, next)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `withdraw`,
      amountHex,
      ts: Date.now()
    })

    await Alert.success(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(next))
  }
}

class Alert {
  static async success(ctx: WithdrawPage, amount: string, balance: string) {
    await ctx.clearSession()
    const bi = Base.success
    const da = {amount, balance}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }

  static async warnInsufficient(ctx: WithdrawPage, balance: string) {
    const bi = Base.warnInsufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async warnInvalid(ctx: WithdrawPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }
}

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.form}">
      ${this.kbk.cancel()}
      <message>
        ➖ Withdraw funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 50.000
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Withdrawal completed

        Amount withdrawn: {{amount}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="${Base.warnInsufficient}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid amount

        We couldn't read: "{{amount}}".
        Please enter a whole number only.
      </message>
    </base>
  `
}
