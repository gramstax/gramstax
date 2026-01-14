import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    await this.sessionTextFree()
    const kb = this.kb()
    const id = `form`
    if (isEdit) {
      await this.edit(kb, {}, id)
      return
    }
    await this.reply(kb, {}, id)
  }

  async callback() {
    await this.to(true)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) {
      return null
    }
    await this.handleDeposit(this.msgText.trim(), false)
  }

  private async handleDeposit(amountInput?: string, isEdit = false) {
    const kb = this.kb()
    const idInv = `invalid`
    if (!amountInput) {
      await this.sessionClear()
      await this.reply(kb, {}, idInv)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.sessionClear()
      await this.reply(kb, {amount: amountInput}, idInv)
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
    if (isEdit) {
      await this.edit(kb, data, idSuc)
      return
    }
    await this.reply(kb, data, idSuc)
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Deposit funds

        Tap Deposit in the menu, then send an amount like:
        - 12.5
      </message>
    </base>

    <base id="form">
      <message>
        Send a deposit amount (6 decimals max).
      </message>
    </base>

    <base id="success">
      <message>
        Deposit successful: {{amount}}
        New balance: {{balance}}
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
