import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static success = `s`
  static warnInsufficient = `w-insufficient`
  static warnInvalid = `w-invalid`
}

class Helper {
  static kb(ctx: WithdrawPage, AGBaseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: WithdrawPage) {
    await ctx.setSessionFreeText()
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: WithdrawPage) {
    const amountInput = ctx.msgText.trim()
    if (!amountInput) {
      return await Main.showWarnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Main.showWarnInvalid(ctx, amountInput)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    if (current < amount) {
      return await Main.showWarnInsufficient(ctx, ctx.bankStore.formatAmount(current))
    }

    const next = current - amount
    const amountHex = ctx.bankStore.toHex(amount)
    ctx.bankStore.setBalance(ctx.userId, next)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `withdraw`,
      amountHex,
      ts: Date.now()
    })

    await Main.showSuccess(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(next))
  }

  static async showSuccess(ctx: WithdrawPage, amount: string, balance: string) {
    await ctx.clearSession()
    const bi = Base.success
    const da = {amount, balance}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }

  static async showWarnInsufficient(ctx: WithdrawPage, balance: string) {
    const bi = Base.warnInsufficient
    const kb = Helper.kb(ctx, bi)
    const da = {balance}
    await ctx.reply(kb, da, bi)
  }

  static async showWarnInvalid(ctx: WithdrawPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }
}

// Withdraw funds from the user's balance.
export class WithdrawPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleSessionFreeText() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.cancel()}
      <g-message>
        ➖ Withdraw funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 50.000
      </g-message>
      ${this.kbk.cancel(`id`)}
      <g-message lang="id">
        ➖ Tarik dana

        Masukkan jumlah sebagai angka bulat. Titik diperbolehkan sebagai pemisah ribuan.
        Contoh: 50.000
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Withdrawal completed

        Amount withdrawn: {{amount}}
        Updated balance: {{balance}}
      </g-message>
      ${this.kbk.home(`id`)}
      <g-message lang="id">
        ✅ Penarikan selesai

        Jumlah ditarik: {{amount}}
        Saldo diperbarui: {{balance}}
      </g-message>
    </g-base>

    <g-base id="${Base.warnInsufficient}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Insufficient funds

        Available balance: {{balance}}
        Please enter a smaller amount.
      </g-message>
      ${this.kbk.cancel(`id`)}
      <g-message lang="id">
        ⚠️ Dana tidak mencukupi

        Saldo tersedia: {{balance}}
        Harap masukkan jumlah yang lebih kecil.
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid amount

        We couldn't read: "{{amount}}".
        Please enter a whole number only.
      </g-message>
      ${this.kbk.cancel(`id`)}
      <g-message lang="id">
        ⚠️ Jumlah tidak valid

        Tidak dapat membaca: "{{amount}}".
        Harap masukkan angka bulat saja.
      </g-message>
    </g-base>
  `
}
