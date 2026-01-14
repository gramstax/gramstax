import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    await this.sessionTextFree()
    const kb = this.kb()

    if (isEdit) {
      await this.edit(kb, {}, `form`)
      return
    }

    await this.reply(kb, {}, `form`)
  }

  async callback() {
    await this.to(true)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) {
      return null
    }
    await this.handleWithdraw(this.msgText.trim(), false)
  }

  private async handleWithdraw(amountInput?: string, isEdit = false) {
    const kb = this.kb()

    if (!amountInput) {
      await this.sessionClear()
      await this.reply(kb, {}, `invalid`)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.sessionClear()
      await this.reply(kb, {amount: amountInput}, `invalid`)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      await this.sessionClear()
      await this.reply(kb, {balance: this.bankStore.formatAmount(current)}, `insufficient`)
      return
    }

    const next = current - amount
    const amountHex = this.bankStore.toHex(amount)
    this.bankStore.setBalance(this.userId, next)
    this.bankStore.recordTransaction(this.userId, {
      type: `withdraw`,
      amountHex,
      ts: Date.now()
    })

    const balance = this.bankStore.formatAmount(next)
    const amountDisplay = this.bankStore.formatAmount(amount)
    const data = {amount: amountDisplay, balance}

    await this.sessionClear()

    if (isEdit) {
      await this.edit(kb, data, `success`)
      return
    }

    await this.reply(kb, data, `success`)
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Withdraw funds

        Tap Withdraw in the menu, then send an amount like:
        - 12.5
      </message>
    </base>

    <base id="form">
      <message>
        Send a withdrawal amount (6 decimals max).
      </message>
    </base>

    <base id="success">
      <message>
        Withdrawal successful: {{amount}}
        New balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      <message>
        Insufficient balance. Current: {{balance}}
      </message>
    </base>

    <base id="invalid">
      <message>
        Invalid amount: "{{amount}}".
        Use up to 6 decimals.
      </message>
    </base>
  `
}
