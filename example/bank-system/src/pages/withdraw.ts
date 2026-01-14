import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
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
    await this.handleWithdraw(this.msgTextPayload, false)
  }

  async textCommandPayload() {
    await this.handleWithdraw(this.msgTextCommandPayload, false)
  }

  private async handleWithdraw(amountInput?: string, isEdit = false) {
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
    if (current < amount) {
      await this.reply(this.kb(), {balance: this.bankStore.formatAmount(current)}, `insufficient`)
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
        Withdraw funds

        Usage:
        - /withdraw 12.5
        - withdraw 12.5
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
