import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static success = `s`
  static warnInvalid = `w-invalid`
}

class Helper {
  static kb(ctx: DepositPage, AGBaseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }
}

class Main {
  static async showIndex(ctx: DepositPage) {
    await ctx.setSessionFreeText()
    const bi = Base.index
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processIndex(ctx: DepositPage) {
    const amountInput = ctx.msgText.trim()
    if (!amountInput) {
      return await Main.showWarnInvalid(ctx)
    }

    const amount = ctx.bankStore.parseAmount(amountInput)
    if (amount === null) {
      return await Main.showWarnInvalid(ctx, amountInput)
    }

    const current = ctx.bankStore.getBalance(ctx.userId)
    const next = current + amount
    const amountHex = ctx.bankStore.toHex(amount)
    ctx.bankStore.setBalance(ctx.userId, next)
    ctx.bankStore.recordTransaction(ctx.userId, {
      type: `deposit`,
      amountHex,
      ts: Date.now()
    })

    await Main.showSuccess(ctx, ctx.bankStore.formatAmount(amount), ctx.bankStore.formatAmount(next))
  }

  static async showSuccess(ctx: DepositPage, amount: string, balance: string) {
    await ctx.clearSession()
    const bi = Base.success
    const da = {amount, balance}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }

  static async showWarnInvalid(ctx: DepositPage, amount = ``) {
    const bi = Base.warnInvalid
    const kb = Helper.kb(ctx, bi)
    const da = {amount}
    await ctx.reply(kb, da, bi)
  }
}

// Deposits funds into the user's balance.
export class DepositPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  async handleSessionFreeText() {
    await Main.processIndex(this)
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        ➕ Deposit funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 125.000
      </g-message>
      <g-message lang="id">
        ➕ Setor dana

        Masukkan jumlah sebagai angka bulat. Titik diperbolehkan sebagai pemisah ribuan.
        Contoh: 125.000
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Deposit completed

        Amount received: {{amount}}
        Updated balance: {{balance}}
      </g-message>
      <g-message lang="id">
        ✅ Setoran selesai

        Jumlah diterima: {{amount}}
        Saldo diperbarui: {{balance}}
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid amount

        We couldn't read: "{{amount}}".
        Please enter a whole number only.
      </g-message>
      <g-message lang="id">
        ⚠️ Jumlah tidak valid

        Tidak dapat membaca: "{{amount}}".
        Harap masukkan angka bulat saja.
      </g-message>
    </g-base>
  `
}
