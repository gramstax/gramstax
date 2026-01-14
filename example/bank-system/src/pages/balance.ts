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

    if (isEdit) {
      await this.edit(this.kb(), {balance: formatted}, `balance`)
      return
    }

    await this.reply(this.kb(), {balance: formatted}, `balance`)
  }

  async textCommand() {
    await this.to(false)
  }

  async text() {
    await this.to(false)
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

    <base id="balance">
      <message>
        Balance: {{balance}}
      </message>
    </base>
  `
}
