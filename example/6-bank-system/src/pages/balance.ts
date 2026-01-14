import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows the current user balance.
export class BalancePage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    const balance = this.bankStore.getBalance(this.userId)
    const formatted = this.bankStore.formatAmount(balance)
    const kb = this.kb()
    const data = {balance: formatted}

    if (isEdit) {
      await this.edit(kb, data)
      return
    }

    await this.reply(kb, data)
  }

  async callback() {
    await this.to(true)
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
