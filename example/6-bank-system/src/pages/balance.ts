import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: BalancePage) {
    const balance = ctx.bankStore.getBalance(ctx.userId)
    const formatted = ctx.bankStore.formatAmount(balance)
    const bi = Base.step1
    const da = {balance: formatted}
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: BalancePage) {
    throw ctx
  }
}

// Shows the current user balance.
export class BalancePage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        💳 Account balance

        Available balance: {{balance}}

        Use the menu to deposit, withdraw, or transfer funds.
      </g-message>
    </g-base>
  `
}
