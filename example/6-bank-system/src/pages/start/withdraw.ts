import {PageBase} from "~/base/page"
import {StartPage} from "."

class Base {
  static index = `i`
  static success = `s`
  static warnInsufficient = `w-insufficient`
  static warnInvalid = `w-invalid`
}

class Helper {
  static kb(ctx: StartWithdrawPage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
}

// Withdraw funds from the user's balance.
export class StartWithdrawPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleSessionFreeText() {
    const amountInput = this.msg!.text!.trim()
    await this.gindex.process(amountInput)
  }

  gindex = {
    show: async () => {
      await this.setSessionFreeText()
      const bi = Base.index
      const kb = Helper.kb(this, bi)
      await this.renderAuto(kb, {}, bi)
    },
    process: async (amountInput: string) => {
      if (!amountInput) {
        return await this.gwarnInvalid.show()
      }

      const amount = this.bankStore.parseAmount(amountInput)
      if (amount === null) {
        return await this.gwarnInvalid.show(amountInput)
      }

      const current = this.bankStore.getBalance(this.from!.id)
      if (current < amount) {
        return this.gwarnInsufficient.show(current)
      }

      const next = current - amount
      this.bankStore.setBalance(this.from!.id, next)
      this.bankStore.recordTransaction(this.from!.id, {
        type: `withdraw`,
        amountHex: this.bankStore.toHex(amount),
        ts: Date.now()
      })

      await this.gsuccess.show(amount, next)
    }
  }
  gsuccess = {
    show: async (amount: bigint, next: bigint) => {
      await this.clearSession()
      const bi = Base.success
      const kb = Helper.kb(this, bi)
      const da = {
        amount: this.bankStore.formatAmount(amount),
        balance: this.bankStore.formatAmount(next)
      }
      await this.renderAuto(kb, da, bi)
    }
  }
  gwarnInsufficient = {
    show: async (current: bigint) => {
      const bi = Base.warnInsufficient
      const kb = Helper.kb(this, bi)
      const da = {balance: this.bankStore.formatAmount(current)}
      await this.renderAuto(kb, da, bi)
    }
  }
  gwarnInvalid = {
    show: async (amount = ``) => {
      const bi = Base.warnInvalid
      const kb = Helper.kb(this, bi)
      const da = {amount}
      await this.renderAuto(kb, da, bi)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        ➖ Withdraw funds

        Enter the amount as a whole number. Dots are allowed for thousand separators.
        Example: 50.000
      </g-message>
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
      <g-message lang="id">
        ⚠️ Jumlah tidak valid

        Tidak dapat membaca: "{{amount}}".
        Harap masukkan angka bulat saja.
      </g-message>
    </g-base>
  `
}
