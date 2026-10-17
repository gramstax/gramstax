import {PageBase} from "~/base/page"
import {StartPage} from "."

class Base {
  static index = `i`
  static success = `s`
  static warnInvalid = `w-invalid`
  static warnInsufficient = `w-insufficient`
  static warnUnknownUser = `w-unknown-user`
  static warnSelf = `w-self`
}

// Transfer funds to another user.
export class StartTransferPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleSessionFreeText() {
    await this.gdefault.process(this.msg!.text!)
  }

  helper = {
    homeKeyboard: (AGBaseId?: string) => {
      return this.inlineKeyboardT([StartPage], `1`, AGBaseId)
    },
    resolveTarget: (input: string) => {
      const trimmed = input.trim()
      if (/^\d+$/.test(trimmed)) {
        return {id: Number(trimmed), label: `#${trimmed}`}
      }

      const username = trimmed.replace(/^@/, ``)
      const userId = this.bankStore.getUserIdByUsername(username)
      if (!userId) {
        return null
      }
      return {id: userId, label: `@${username}`}
    }
  }
  gdefault = {
    show: async () => {
      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.homeKeyboard(Base.index)})
    },
    process: async (input: string) => {
      const [amountInput, targetInput] = input.trim().split(/\s+/)
      if (!amountInput || !targetInput) {
        return await this.gwarnInvalid.show()
      }

      const amount = this.bankStore.parseAmount(amountInput)
      if (amount === null) {
        return await this.gwarnInvalid.show(amountInput)
      }

      const target = this.helper.resolveTarget(targetInput)
      if (!target) {
        return await this.gwarnUnknownUser.show(targetInput)
      }

      if (target.id === this.from!.id) {
        return await this.gwarnSelf.show()
      }

      const current = this.bankStore.getBalance(this.from!.id)
      if (current < amount) {
        return await this.gwarnInsufficient.show(this.bankStore.formatAmount(current))
      }

      const nextSender = current - amount
      const targetBalance = this.bankStore.getBalance(target.id)
      const nextTarget = targetBalance + amount
      const amountHex = this.bankStore.toHex(amount)

      this.bankStore.setBalance(this.from!.id, nextSender)
      this.bankStore.setBalance(target.id, nextTarget)
      this.bankStore.recordTransaction(this.from!.id, {
        type: `transfer-out`,
        amountHex,
        peerId: target.id,
        peerName: target.label,
        ts: Date.now()
      })
      this.bankStore.recordTransaction(target.id, {
        type: `transfer-in`,
        amountHex,
        peerId: this.from!.id,
        peerName: this.from?.username || `user-${this.from!.id}`,
        ts: Date.now()
      })

      await this.gsuccess.show(this.bankStore.formatAmount(amount), this.bankStore.formatAmount(nextSender), target.label)
    }
  }
  gwarnInvalid = {
    show: async (amount = ``) => {
      await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.homeKeyboard(Base.warnInvalid), data: {amount}})
    },
    process: () => {}
  }
  gwarnUnknownUser = {
    show: async (target: string) => {
      await this.renderText({AGBaseId: Base.warnUnknownUser, keyboard: this.helper.homeKeyboard(Base.warnUnknownUser), data: {target}})
    },
    process: () => {}
  }
  gwarnSelf = {
    show: async () => {
      await this.renderText({AGBaseId: Base.warnSelf, keyboard: this.helper.homeKeyboard(Base.warnSelf)})
    },
    process: () => {}
  }
  gwarnInsufficient = {
    show: async (balance: string) => {
      await this.renderText({AGBaseId: Base.warnInsufficient, keyboard: this.helper.homeKeyboard(Base.warnInsufficient), data: {balance}})
    },
    process: () => {}
  }
  gsuccess = {
    show: async (amount: string, balance: string, target: string) => {
      await this.clearSession()
      await this.renderText({AGBaseId: Base.success, keyboard: this.helper.homeKeyboard(Base.success), data: {amount, balance, target}})
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        🔁 Transfer funds

        Enter: [amount] [recipient]
        Amounts must be whole numbers. Dots are allowed for thousand separators.

        Example: 125.000 12345
      </g-message>
      <g-message lang="id">
        🔁 Transfer dana

        Masukkan: [jumlah] [penerima]
        Jumlah harus angka bulat. Titik diperbolehkan sebagai pemisah ribuan.

        Contoh: 125.000 12345
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Transfer completed

        Sent {{amount}} to {{target}}
        Updated balance: {{balance}}
      </g-message>
      <g-message lang="id">
        ✅ Transfer selesai

        Terkirim {{amount}} ke {{target}}
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
    <g-base id="${Base.warnUnknownUser}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Recipient not found

        We couldn't resolve: "{{target}}".
        Provide a numeric ID or a registered username.
      </g-message>
      <g-message lang="id">
        ⚠️ Penerima tidak ditemukan

        Tidak dapat menemukan: "{{target}}".
        Berikan ID numerik atau nama pengguna terdaftar.
      </g-message>
    </g-base>
    <g-base id="${Base.warnSelf}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Transfer blocked

        Transfers to your own account are not permitted.
        Please choose a different recipient.
      </g-message>
      <g-message lang="id">
        ⚠️ Transfer diblokir

        Transfer ke akun Anda sendiri tidak diizinkan.
        Harap pilih penerima yang berbeda.
      </g-message>
    </g-base>
    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid transfer format

        Use the format: [amount] [recipient]
        Example: 125.000 12345
      </g-message>
      <g-message lang="id">
        ⚠️ Format transfer tidak valid

        Gunakan format: [jumlah] [penerima]
        Contoh: 125.000 12345
      </g-message>
    </g-base>
  `
}
