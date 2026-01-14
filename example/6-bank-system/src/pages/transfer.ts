import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Transfer funds to another user.
export class TransferPage extends PageBase {
  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async callback() {
    await this.sessionTextFree()
    const kb = this.kb()
    const id = `form`
    await this.edit(kb, {}, id)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) {
      return null
    }
    const payloads = this.msgText.trim().split(/\s+/)
    await this.handleTransfer(payloads, false)
  }

  private async handleTransfer(payloads: string[], isEdit = false) {
    const kb = this.kb()
    const [amountInput, targetInput] = payloads
    if (!amountInput || !targetInput) {
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

    const target = this.resolveTarget(targetInput)
    if (!target) {
      await this.sessionClear()
      await this.reply(kb, {target: targetInput}, `unknown-user`)
      return
    }

    if (target.id === this.userId) {
      await this.sessionClear()
      await this.reply(kb, {}, `self`)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      await this.reply(kb, {balance: this.bankStore.formatAmount(current)}, `insufficient`)
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
    if (isEdit) {
      await this.edit(kb, data, `success`)
      return
    }
    await this.reply(kb, data, `success`)
  }

  private resolveTarget(input: string) {
    const trimmed = input.trim()
    if (/^\d+$/.test(trimmed)) {
      return {id: Number(trimmed), label: `#${trimmed}`}
    }
    const username = trimmed.replace(/^@/, ``)
    const userId = this.bankStore.getUserIdByUsername(username)
    if (!userId) return null
    return {id: userId, label: `@${username}`}
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Transfer funds

        Tap Transfer in the menu, then send:
        - 12.5 12345
        - 12.5 @username
      </message>
    </base>

    <base id="form">
      <message>
        Send: [amount] [user]
      </message>
    </base>

    <base id="success">
      <message>
        Transfer successful: {{amount}} to {{target}}
        New balance: {{balance}}
      </message>
    </base>

    <base id="insufficient">
      <message>
        Insufficient balance. Current: {{balance}}
      </message>
    </base>

    <base id="unknown-user">
      <message>
        Unknown user: "{{target}}".
        Use a numeric ID or a known username.
      </message>
    </base>

    <base id="self">
      <message>
        You cannot transfer to yourself.
      </message>
    </base>

    <base id="invalid">
      <message>
        Invalid transfer input.
        Example: 12.5 12345
      </message>
    </base>
  `
}
