import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboard(
      (k, a) => {
        return k.text(a[0]!, StartPage.data.callback())
      },
      {baseId}
    )
  }

  async callback() {
    await this.sessionTextFree()
    const bi = `form`
    const kb = this.kb(bi)
    await this.edit(kb, {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) {
      return null
    }
    await this.handleWithdraw(this.msgText.trim(), false)
  }

  private async handleWithdraw(amountInput?: string, isEdit = false) {
    const biInv = `invalid`
    if (!amountInput) {
      await this.reply(this.kb(biInv), {}, biInv)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.reply(this.kb(biInv), {amount: amountInput}, biInv)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      const biIns = `insufficient`
      await this.reply(this.kb(biInv), {balance: this.bankStore.formatAmount(current)}, biIns)
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
    const biSuc = `success`
    const kb = this.kb(biSuc)
    if (isEdit) {
      await this.edit(kb, data, biSuc)
    } else {
      await this.reply(kb, data, biSuc)
    }
  }

  static template = `
    <base id="form">
      ${this.kbk.cancel(`default`)}
      <message>
        Please enter the withdrawal amount as a whole number. Dots are accepted for thousand separators.
      </message>
    </base>

    <base id="success">
      ${this.kbk.home(`default`)}
      <message>
        Withdrawal completed: {{amount}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      ${this.kbk.cancel(`default`)}
      <message>
        Insufficient funds for this withdrawal.
        Available balance: {{balance}}
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel(`default`)}
      <message>
        Invalid amount: "{{amount}}".
        Enter a whole number only
      </message>
    </base>
  `
}
