// Withdraw funds from the user's balance.
import {PageBase} from "~/base/page"
import {StartPage} from "."

class Base {
  static index = `i`
  static success = `s`
  static warnInsufficient = `w-insufficient`
  static warnInvalid = `w-invalid`
}

export class StartWithdrawPage extends PageBase {
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
      await this.renderText({AGBaseId: Base.success, keyboard: this.helper.homeKeyboard(Base.success), data: {amount: this.bankStore.formatAmount(amount), balance: this.bankStore.formatAmount(next)}})
    },
    process: () => {}
  }
  gwarnInsufficient = {
    show: async (current: bigint) => {
      await this.renderText({AGBaseId: Base.warnInsufficient, keyboard: this.helper.homeKeyboard(Base.warnInsufficient), data: {balance: this.bankStore.formatAmount(current)}})
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
