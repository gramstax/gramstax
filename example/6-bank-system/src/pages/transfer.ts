import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static success = `s`
  static warnInvalid = `w-invalid`
  static warnInsufficient = `w-insufficient`
  static warnUnknownUser = `w-unknown-user`
  static warnSelf = `w-self`
}

class Helper {
  static kb(ctx: TransferPage, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }

  static resolveTarget(ctx: TransferPage, input: string) {
    const trimmed = input.trim()
    if (/^\d+$/.test(trimmed)) {
      return {id: Number(trimmed), label: `#${trimmed}`}
    }

    const username = trimmed.replace(/^@/, ``)
    const userId = ctx.bankStore.getUserIdByUsername(username)
    if (!userId) {
      return null
    }
    return {id: userId, label: `@${username}`}
  }
}

class Main {
  static async showStep1Form(ctx: TransferPage) {
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: TransferPage) {
    const [amountInput, targetInput] = ctx.msgText.trim().split(/\s+/)
    if (!amountInput || !targetInput) {
      return await Alert.showWarnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.showWarnInvalid(ctx, amountInput)
    }

    const target = Helper.resolveTarget(ctx, targetInput)
    if (!target) {
      return await Alert.showWarnUnknownUser(ctx, targetInput)
    }

    if (target.id === ctx.userId) {
      return await Alert.showWarnSelf(ctx)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Alert.showWarnInsufficient(ctx, ctx.bankStore.formatAmount(current))
    }

    const nextSender = current - amount
    const targetBalance = ctx.bankStore.getBalance(target.id)
    const nextTarget = targetBalance + amount
    const amountHex = ctx.bankStore.toHex(amount)

    ctx.bankStore.setBalance(ctx.userId, nextSender)
    ctx.bankStore.setBalance(target.id, nextTarget)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `transfer-out`,
      amountHex,
      peerId: target.id,
      peerName: target.label,
      ts: Date.now()
    })
    ctx.bankStore.recordTransaction(target.id, {
      type: `transfer-in`,
      amountHex,
      peerId: ctx.userId,
      peerName: ctx.userName || `user-${ctx.userId}`,
      ts: Date.now()
    })

    await Alert.showSuccess(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(nextSender), target.label)
  }
}

class Alert {
  static async showWarnInvalid(ctx: TransferPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }

  static async showWarnUnknownUser(ctx: TransferPage, target: string) {
    const bi = Base.warnUnknownUser
    const kb = Helper.kb(ctx, bi)
    const da = {target}
    await ctx.reply(kb, da, bi)
  }

  static async showWarnSelf(ctx: TransferPage) {
    const bi = Base.warnSelf
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async showWarnInsufficient(ctx: TransferPage, balance: string) {
    const bi = Base.warnInsufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async showSuccess(ctx: TransferPage, amount: string, balance: string, target: string) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const da = {amount, balance, target}
    await ctx.reply(kb, da, bi)
  }
}

// Transfer funds to another user.
export class TransferPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.cancel()}
      <message>
        🔁 Transfer funds

        Enter: [amount] [recipient]
        Amounts must be whole numbers. Dots are allowed for thousand separators.

        Example: 125.000 12345
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Transfer completed

        Sent {{amount}} to {{target}}
        Updated balance: {{balance}}
      </message>
    </base>

    <base id="${Base.warnInsufficient}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </message>
    </base>

    <base id="${Base.warnUnknownUser}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Recipient not found

        We couldn't resolve: "{{target}}".
        Provide a numeric ID or a registered username.
      </message>
    </base>

    <base id="${Base.warnSelf}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Transfer blocked

        Transfers to your own account are not permitted.
        Please choose a different recipient.
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid transfer format

        Use the format: [amount] [recipient]
        Example: 125.000 12345
      </message>
    </base>
  `
}
