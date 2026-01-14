import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows the current user balance.
export class BalancePage extends PageBase {
  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async callback() {
    const balance = this.bankStore.getBalance(this.userId)
    const formatted = this.bankStore.formatAmount(balance)
    const data = {balance: formatted}
    const kb = this.kb()
    await this.edit(kb, data)
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Balance: {{balance}}
      </message>
    </base>
  `
}
