import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    if (isEdit) {
      await this.edit(this.kb(), {}, `form`)
      return
    }

    await this.reply(this.kb(), {}, `form`)
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

  async textPayload() {
    await this.handleDeposit(this.msgTextPayload, false)
  }

  async textCommandPayload() {
    await this.handleDeposit(this.msgTextCommandPayload, false)
  }

  private async handleDeposit(amountInput?: string, isEdit = false) {
    if (!amountInput) {
      await this.reply(this.kb(), {}, `invalid`)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.reply(this.kb(), {amount: amountInput}, `invalid`)
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

    if (isEdit) {
      await this.edit(this.kb(), {amount: amountDisplay, balance}, `success`)
      return
    }

    await this.reply(this.kb(), {amount: amountDisplay, balance}, `success`)
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Deposit funds

        Usage:
        - /deposit 12.5
        - deposit 12.5
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
