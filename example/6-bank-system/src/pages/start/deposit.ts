import {PageBase} from "~/base/page"
import {StartPage} from "."

class Base {
  static index = `i`
  static success = `s`
  static warnInvalid = `w-invalid`
}

class Helper {
  static kb(ctx: StartDepositPage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
}

// Deposits funds into the user's balance.
export class StartDepositPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.bindex.show()
  }

  async handleSessionFreeText() {
    const amountInput = this.msg!.text!.trim()
    await this.bindex.process(amountInput)
  }

  bindex = {
    show: async () => {
      await this.setSessionFreeText()
      const bi = Base.index
      const kb = Helper.kb(this, bi)
      await this.renderAuto(kb, {}, bi)
    },
    process: async (amountInput: string) => {
      if (!amountInput) {
        return await this.bwarnInvalid.show()
      }

      const amount = this.bankStore.parseAmount(amountInput)
      if (amount === null) {
        return await this.bwarnInvalid.show(amountInput)
      }

      const current = this.bankStore.getBalance(this.from!.id)
      const next = current + amount
      const amountHex = this.bankStore.toHex(amount)
      this.bankStore.setBalance(this.from!.id, next)
      this.bankStore.recordTransaction(this.from!.id, {
        type: `deposit`,
        amountHex,
        ts: Date.now()
      })

      await this.bsuccess.show(amount, next)
    }
  }
  bsuccess = {
    show: async (amount: bigint, next: bigint) => {
      await this.clearSession()
      const bi = Base.success
      const da = {
        amount: this.bankStore.formatAmount(amount),
        balance: this.bankStore.formatAmount(next)
      }
      const kb = Helper.kb(this, bi)
      await this.renderAuto(kb, da, bi)
    }
  }
  bwarnInvalid = {
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
