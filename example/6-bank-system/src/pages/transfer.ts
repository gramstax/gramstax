import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Transfer funds to another user.
export class TransferPage extends PageBase {
  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionTextFree()
    const bi = `form`
    const kb = this.kb(bi)
    await this.edit(kb, {}, bi)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    const payloads = this.msgText.trim().split(/\s+/)
    await this.handleTransfer(payloads, false)
  }

  private async handleTransfer(payloads: string[], edit = false) {
    const [amountInput, targetInput] = payloads
    const biInv = `invalid`
    if (!amountInput || !targetInput) {
      await this.reply(this.kb(biInv), {}, biInv)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.reply(this.kb(biInv), {amount: amountInput}, biInv)
      return
    }

    const target = this.resolveTarget(targetInput)
    if (!target) {
      const bi = `unknown-user`
      await this.reply(this.kb(bi), {target: targetInput}, bi)
      return
    }

    if (target.id === this.userId) {
      const bi = `self`
      await this.reply(this.kb(bi), {}, bi)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      const bi = `insufficient`
      await this.reply(this.kb(bi), {balance: this.bankStore.formatAmount(current)}, bi)
      return
    }

    const nextSender = current - amount
    const targetBalance = this.bankStore.getBalance(target.id)
    const nextTarget = targetBalance + amount
    const amountHex = this.bankStore.toHex(amount)

    this.bankStore.setBalance(this.userId, nextSender)
    this.bankStore.setBalance(target.id, nextTarget)

    this.bankStore.recordTransaction(this.userId, {
      type: `transfer-out`,
      amountHex,
      peerId: target.id,
      peerName: target.label,
      ts: Date.now()
    })
    this.bankStore.recordTransaction(target.id, {
      type: `transfer-in`,
      amountHex,
      peerId: this.userId,
      peerName: this.userName || `user-${this.userId}`,
      ts: Date.now()
    })

    const amountDisplay = this.bankStore.formatAmount(amount)
    const balance = this.bankStore.formatAmount(nextSender)
    const data = {amount: amountDisplay, balance, target: target.label}

    await this.sessionClear()
    const biSuc = `success`
    const kb = this.kb(biSuc)
    if (edit) await this.edit(kb, data, biSuc)
    else await this.reply(kb, data, biSuc)
  }

  private resolveTarget(input: string) {
    const trimmed = input.trim()
    if (/^\d+$/.test(trimmed)) return {id: Number(trimmed), label: `#${trimmed}`}

    const username = trimmed.replace(/^@/, ``)
    const userId = this.bankStore.getUserIdByUsername(username)
    if (!userId) return null
    return {id: userId, label: `@${username}`}
  }

  static template = `
    <base id="form">
      ${this.kbk.cancel(`default`)}
      <message>
        Enter: [amount] [recipient]

        Amounts must be whole numbers. Dots are accepted for thousand separators.
      </message>
    </base>

    <base id="success">
      ${this.kbk.home(`default`)}
      <message>
        Transfer completed: {{amount}} to {{target}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      ${this.kbk.cancel(`default`)}
      <message>
        Insufficient funds for this transfer.
        Available balance: {{balance}}
      </message>
    </base>

    <base id="unknown-user">
      ${this.kbk.cancel(`default`)}
      <message>
        Recipient not found: "{{target}}".
        Provide a numeric ID or a registered username.
      </message>
    </base>

    <base id="self">
      ${this.kbk.cancel(`default`)}
      <message>
        Transfers to your own account are not permitted.
        Please choose a different recipient.
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel(`default`)}
      <message>
        Invalid transfer format.
        Example: 125.000 12345
      </message>
    </base>
  `
}
