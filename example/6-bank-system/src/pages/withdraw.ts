import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  static BASE = {form: `form`, success: `success`, insufficient: `insufficient`, invalid: `invalid`}

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree()
    const bi = WithdrawPage.BASE.form
    const kb = this.kb(bi)
    await this.edit(kb, {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.handleWithdraw(this.msgText.trim(), false)
  }

  private async handleWithdraw(amountInput?: string, edit = false) {
    const {BASE} = WithdrawPage
    const biInv = BASE.invalid
    if (!amountInput) {
      return await this.reply(this.kb(biInv), {}, biInv)
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await this.reply(this.kb(biInv), {amount: amountInput}, biInv)
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      const biIns = BASE.insufficient
      return await this.reply(this.kb(biInv), {balance: this.bankStore.formatAmount(current)}, biIns)
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
    const biSuc = BASE.success
    const kb = this.kb(biSuc)
    if (edit) await this.edit(kb, data, biSuc)
    else await this.reply(kb, data, biSuc)
  }

  static template = `
    <base id="form">
      ${this.kbk.cancel()}
      <message>
        ➖ Withdraw funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 50.000
      </message>
    </base>

    <base id="success">
      ${this.kbk.home()}
      <message>
        ✅ Withdrawal completed

        Amount withdrawn: {{amount}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid amount

        We couldn't read: "{{amount}}".
        Please enter a whole number only.
      </message>
    </base>
  `
}
