import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Transfer funds to another user.
export class TransferPage extends PageBase {
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
    const id = `form`
    const kb = this.kb(id)
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
    const [amountInput, targetInput] = payloads
    const idInv = `invalid`
    if (!amountInput || !targetInput) {
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

    const target = this.resolveTarget(targetInput)
    if (!target) {
      const idUnknown = `unknown-user`
      await this.sessionClear()
      await this.reply(this.kb(), {target: targetInput}, idUnknown)
      return
    }

    if (target.id === this.userId) {
      const idSelf = `self`
      await this.sessionClear()
      await this.reply(this.kb(), {}, idSelf)
      return
    }

    const current = this.bankStore.getBalance(this.userId)
    if (current < amount) {
      const idIns = `insufficient`
      await this.sessionClear()
      await this.reply(this.kb(), {balance: this.bankStore.formatAmount(current)}, idIns)
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
    const idSuc = `success`
    const kb = this.kb()
    if (isEdit) await this.edit(kb, data, idSuc)
    else await this.reply(kb, data, idSuc)
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
      <keyboard>Home</keyboard>
      <message>
        Transfer

        Send funds by entering a whole-number amount and a recipient ID or username.
        Examples:
        - 125.000 12345
        - 125.000 @username

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="form">
      <keyboard>Cancel</keyboard>
      <message>
        Enter: [amount] [recipient]

        Amounts must be whole numbers. Dots are accepted for thousand separators.
        Use Cancel to return to the main menu.
      </message>
    </base>

    <base id="success">
      <message>
        Transfer completed: {{amount}} to {{target}}
        Updated balance: {{balance}}

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="insufficient">
      <message>
        Insufficient funds for this transfer.
        Available balance: {{balance}}

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="unknown-user">
      <message>
        Recipient not found: "{{target}}".
        Provide a numeric ID or a registered username.

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="self">
      <message>
        Transfers to your own account are not permitted.
        Please choose a different recipient.

        Use Home to return to the main menu.
      </message>
    </base>

    <base id="invalid">
      <message>
        Invalid transfer format.
        Example: 125.000 12345

        Use Home to return to the main menu.
      </message>
    </base>
  `
}
