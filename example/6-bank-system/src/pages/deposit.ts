import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static form = `form`
  static success = `success`
  static warnInvalid = `invalid`
}

class Helper {
  static kb(ctx: DepositPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Alert {
  static async success(ctx: DepositPage, amount: string, balance: string) {
    await ctx.clearSession()
    const bi = Base.success
    const da = {amount, balance}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }

  static async warnInvalid(ctx: DepositPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: DepositPage) {
    await ctx.sessionFreeText()
    const bi = Base.form
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim()
    if (!amountInput) {
      return await Alert.warnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.warnInvalid(ctx, amountInput)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    const next = current + amount
    const amountHex = ctx.bankStore.toHex(amount)
    ctx.bankStore.setBalance(ctx.userId, next)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `deposit`,
      amountHex,
      ts: Date.now()
    })

    await Alert.success(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(next))
  }
}

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
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
        ➕ Deposit funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 125.000
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Deposit completed

        Amount received: {{amount}}
        Updated balance: {{balance}}
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
