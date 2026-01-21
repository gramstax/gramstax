import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree()
    await this.edit(this.kb(), {}, `form`)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.handleDeposit(this.msgText.trim(), false)
  }

  private async handleDeposit(amountInput?: string, edit = false) {
    const biInv = `invalid`
    if (!amountInput) {
      return await this.reply(this.kb(biInv), {}, biInv)
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await this.reply(this.kb(biInv), {amount: amountInput}, biInv)
    }

    const current = this.bankStore.getBalance(this.userId)
    const next = current + amount
    const amountHex = this.bankStore.toHex(amount)
    this.bankStore.setBalance(this.userId, next)
    this.bankStore.recordTransaction(this.userId, {
      type: `deposit`,
      amountHex,
      ts: Date.now()
    })

    const balance = this.bankStore.formatAmount(next)
    const amountDisplay = this.bankStore.formatAmount(amount)
    const data = {amount: amountDisplay, balance}

    await this.sessionClear()
    const biSuc = `success`
    const kb = this.kb(biSuc)
    if (edit) await this.edit(kb, data, biSuc)
    else await this.reply(kb, data, biSuc)
  }

  static template = `
    <base id="form">
      ${this.kbk.cancel(`default`)}
      <message>
        Please enter the deposit amount as a whole number. Dots are accepted for thousand separators.
      </message>
    </base>

    <base id="success">
      ${this.kbk.home(`default`)}
      <message>
        Deposit completed: {{amount}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel(`default`)}
      <message>
        Invalid amount: "{{amount}}".
        Enter a whole number only.
      </message>
    </base>
  `
}
