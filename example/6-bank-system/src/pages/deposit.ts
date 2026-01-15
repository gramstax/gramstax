import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
  kb(baseId = `default`) {
    return this.inlineKeyboard((k, a) => k.text(a[0]!, StartPage.data.callback()), {baseId})
  }

  async callback() {
    await this.sessionTextFree()
    const id = `form`
    const kb = this.kb(id)
    await this.edit(kb, {}, id)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) {
      return null
    }
    await this.handleDeposit(this.msgText.trim(), false)
  }

  private async handleDeposit(amountInput?: string, isEdit = false) {
    const idInv = `invalid`
    if (!amountInput) {
      await this.sessionClear()
      await this.reply(this.kb(), {}, idInv)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.sessionClear()
      await this.reply(this.kb(), {amount: amountInput}, idInv)
      return
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
    const idSuc = `success`
    const kb = this.kb()
    if (isEdit) {
      await this.edit(kb, data, idSuc)
      return
    }
    await this.reply(kb, data, idSuc)
  }

  static template = `
    <base>
      <keyboard>Home</keyboard>
      <message>
        Deposit

        Add funds to your account by entering a whole-number amount.
        Example:
        - 125.000

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="form">
      <keyboard>Cancel</keyboard>
      <message>
        Please enter the deposit amount as a whole number. Dots are accepted for thousand separators.
        Use Cancel to return to the main menu.
      </message>
    </base>

    <base id="success">
      <message>
        Deposit completed: {{amount}}
        Updated balance: {{balance}}

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="invalid">
      <message>
        Invalid amount: "{{amount}}".
        Enter a whole number only (no decimals).

        Use Home to return to the main menu.
      </message>
    </base>
  `
}
