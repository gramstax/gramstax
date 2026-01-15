import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows the current user balance.
export class BalancePage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
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
      ${this.kbk.back(`default`)}
      <message>
        Account balance: {{balance}}

        This is your current available balance. Use the menu to make a deposit, withdrawal, or transfer.
      </message>
    </base>
  `
}
