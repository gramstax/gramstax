import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: BalancePage) {
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
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        💳 Account balance

        Available balance: {{balance}}

        Use the menu to deposit, withdraw, or transfer funds.
      </g-message>
      <g-message lang="id">
        💳 Saldo Akun

        Saldo tersedia: {{balance}}

        Gunakan menu untuk menyetor, menarik, atau mentransfer dana.
      </g-message>
    </g-base>
  `
}
