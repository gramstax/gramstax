import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: BalancePage) {
    const balance = ctx.bankStore.getBalance(ctx.userId)
    const formatted = ctx.bankStore.formatAmount(balance)
    const bi = Base.index
    const da = {balance: formatted}
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    await ctx.edit(kb, da, bi)
  }
}

// Shows the current user balance.
export class BalancePage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.back()}
      <message>
        💳 Account balance

        Available balance: {{balance}}

        Use the menu to deposit, withdraw, or transfer funds.
      </message>
    </base>
  `
}
