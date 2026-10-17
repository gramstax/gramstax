import {PageBase} from "~/base/page"
import {StartPage} from "."

class Base {
  static index = `i`
  static success = `s`
  static warnInvalid = `w-invalid`
}

// Deposits funds into the user's balance.
export class StartDepositPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleSessionFreeText() {
    const amountInput = this.msg!.text!.trim()
    await this.gindex.process(amountInput)
  }

  helper = {
    homeKeyboard: (AGBaseId?: string) => this.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
  gindex = {
    show: async () => {
      await this.setSessionFreeText()
      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.homeKeyboard(Base.index)})
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
      const next = current + amount
      const amountHex = this.bankStore.toHex(amount)
      this.bankStore.setBalance(this.from!.id, next)
      this.bankStore.recordTransaction(this.from!.id, {
        type: `deposit`,
        amountHex,
        ts: Date.now()
      })

      await this.gsuccess.show(amount, next)
    }
  }
  gsuccess = {
    show: async (amount: bigint, next: bigint) => {
      await this.clearSession()
      await this.renderText({AGBaseId: Base.success, keyboard: this.helper.homeKeyboard(Base.success), data: {amount: this.bankStore.formatAmount(amount), balance: this.bankStore.formatAmount(next)}})
    },
    process: () => {}
  }
  gwarnInvalid = {
    show: async (amount = ``) => {
      await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.homeKeyboard(Base.warnInvalid), data: {amount}})
    },
    process: () => {}
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
