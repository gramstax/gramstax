import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows the current user balance.
export class BalancePage extends PageBase {
  async callback() {
    const balance = this.bankStore.getBalance(this.userId)
    const formatted = this.bankStore.formatAmount(balance)
    const data = {balance: formatted}
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, data)
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
