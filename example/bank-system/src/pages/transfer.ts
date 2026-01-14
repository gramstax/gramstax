import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Transfer funds to another user.
export class TransferPage extends PageBase {
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
    await this.handleTransfer(this.msgTextPayloads, false)
  }

  async textCommandPayload() {
    await this.handleTransfer(this.msgTextCommandPayloads, false)
  }

  private async handleTransfer(payloads: string[], isEdit = false) {
    const [amountInput, targetInput] = payloads
    if (!amountInput || !targetInput) {
      await this.reply(this.kb(), {}, `invalid`)
      return
    }

    const amount = this.bankStore.parseAmount(amountInput)
    if (amount === null) {
      await this.reply(this.kb(), {amount: amountInput}, `invalid`)
      return
    }

    const target = this.resolveTarget(targetInput)
    if (!target) {
      await this.reply(this.kb(), {target: targetInput}, `unknown-user`)
      return
    }

    if (target.id === this.userId) {
      await this.reply(this.kb(), {}, `self`)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      await this.reply(this.kb(), {balance: this.bankStore.formatAmount(current)}, `insufficient`)
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

    if (isEdit) {
      await this.edit(this.kb(), {amount: amountDisplay, balance, target: target.label}, `success`)
      return
    }

    await this.reply(this.kb(), {amount: amountDisplay, balance, target: target.label}, `success`)
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

        Usage:
        - /transfer 12.5 12345
        - /transfer 12.5 @username
        - transfer 12.5 12345
      </message>
    </base>

    <base id="form">
      <message>
        Send: /transfer <amount> <user>
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
        Example: /transfer 12.5 12345
      </message>
    </base>
  `
}
