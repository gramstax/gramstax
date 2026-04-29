import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: BalancePage) {
    const balance = ctx.bankStore.getBalance(ctx.userId)
    const formatted = ctx.bankStore.formatAmount(balance)
    const da = {balance: formatted}
    const kb = ctx.inlineKeyboardT([StartPage])
    await ctx.edit(kb, da)
  }
}

// Shows the current user balance.
export class BalancePage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        💳 Account balance

        Available balance: {{balance}}

        Use the menu to deposit, withdraw, or transfer funds.
      </message>
    </base>
  `
}
