import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static form = `form`
  static success = `success`
  static warnInvalid = `invalid`
  static warnInsufficient = `w-insufficient`
  static warnUnknownUser = `w-unknown-user`
  static warnSelf = `w-self`
}

class Helper {
  static kb(ctx: TransferPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
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
    const bi = Base.form
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: TransferPage) {
    const [amountInput, targetInput] = ctx.msgText.trim().split(/\s+/)
    if (!amountInput || !targetInput) {
      return await Alert.warnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.warnInvalid(ctx, amountInput)
    }

    const target = Helper.resolveTarget(ctx, targetInput)
    if (!target) {
      return await Alert.warnUnknownUser(ctx, targetInput)
    }

    if (target.id === ctx.userId) {
      return await Alert.warnSelf(ctx)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Alert.warnInsufficient(ctx, ctx.bankStore.formatAmount(current))
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

    await Alert.success(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(nextSender), target.label)
  }
}

class Alert {
  static async warnInvalid(ctx: TransferPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }

  static async warnUnknownUser(ctx: TransferPage, target: string) {
    const bi = Base.warnUnknownUser
    const kb = Helper.kb(ctx, bi)
    const da = {target}
    await ctx.reply(kb, da, bi)
  }

  static async warnSelf(ctx: TransferPage) {
    const bi = Base.warnSelf
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async warnInsufficient(ctx: TransferPage, balance: string) {
    const bi = Base.warnInsufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async success(ctx: TransferPage, amount: string, balance: string, target: string) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const data = {amount, balance, target}
    await ctx.reply(kb, data, bi)
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
    <base id="${Base.form}">
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
