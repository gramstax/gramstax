import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static form = `form`
  static invalid = `invalid`
  static success = `success`
  static insufficient = `insufficient`
  static unknownUser = `unknown-user`
  static self = `self`
}

class Helper {
  static kb(ctx: TransferPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Perform {
  static async entryPoint(ctx: TransferPage) {
    const bi = Base.form
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
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

class Alert {
  static async invalid(ctx: TransferPage, amount = ``) {
    const bi = Base.invalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }

  static async unknownUser(ctx: TransferPage, target: string) {
    const bi = Base.unknownUser
    const kb = Helper.kb(ctx, bi)
    const da = {target}
    await ctx.reply(kb, da, bi)
  }

  static async self(ctx: TransferPage) {
    const bi = Base.self
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async insufficient(ctx: TransferPage, balance: string) {
    const bi = Base.insufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async success(ctx: TransferPage, amount: string, balance: string, target: string, edit = false) {
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const data = {amount, balance, target}
    if (edit) {
      await ctx.edit(kb, data, bi)
    } else {
      await ctx.reply(kb, data, bi)
    }
  }
}

class Flow {
  static async process(ctx: TransferPage) {
    const [amountInput, targetInput] = ctx.msgText.trim().split(/\s+/)
    if (!amountInput || !targetInput) {
      return await Alert.invalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Alert.invalid(ctx, amountInput)
    }

    const target = Perform.resolveTarget(ctx, targetInput)
    if (!target) {
      return await Alert.unknownUser(ctx, targetInput)
    }

    if (target.id === ctx.userId) {
      return await Alert.self(ctx)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Alert.insufficient(ctx, ctx.bankStore.formatAmount(current))
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

    await ctx.clearSession()
    await Alert.success(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(nextSender), target.label)
  }
}

// Transfer funds to another user.
export class TransferPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Flow.process(this)
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

    <base id="${Base.insufficient}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </message>
    </base>

    <base id="${Base.unknownUser}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Recipient not found

        We couldn't resolve: "{{target}}".
        Provide a numeric ID or a registered username.
      </message>
    </base>

    <base id="${Base.self}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Transfer blocked

        Transfers to your own account are not permitted.
        Please choose a different recipient.
      </message>
    </base>

    <base id="${Base.invalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid transfer format

        Use the format: [amount] [recipient]
        Example: 125.000 12345
      </message>
    </base>
  `
}
