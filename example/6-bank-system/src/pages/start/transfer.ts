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

class Helper {
  static kb(ctx: StartTransferPage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }

  static resolveTarget(ctx: StartTransferPage, input: string) {
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

// Transfer funds to another user.
export class StartTransferPage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  async handleSessionFreeText() {
    await this.bdefault.process(this.msg!.text!)
  }

  bdefault = {
    show: async () => {
      const bi = Base.index
      const kb = Helper.kb(this, bi)
      await this.renderEdit(kb, {}, bi)
    },
    process: async (input: string) => {
      const [amountInput, targetInput] = input.trim().split(/\s+/)
      if (!amountInput || !targetInput) {
        return await this.bwarnInvalid.show()
      }

      const amount = this.bankStore.parseAmount(amountInput)
      if (amount === null) {
        return await this.bwarnInvalid.show(amountInput)
      }

      const target = Helper.resolveTarget(this, targetInput)
      if (!target) {
        return await this.bwarnUnknownUser.show(targetInput)
      }

      if (target.id === this.from!.id) {
        return await this.bwarnSelf.show()
      }

      const current = this.bankStore.getBalance(this.from!.id)
      if (current < amount) {
        return await this.bwarnInsufficient.show(this.bankStore.formatAmount(current))
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

      await this.bsuccess.show(this.bankStore.formatAmount(amount), this.bankStore.formatAmount(nextSender), target.label)
    }
  }
  bwarnInvalid = {
    show: async (amount = ``) => {
      const bi = Base.warnInvalid
      const kb = Helper.kb(this, bi)
      const da = {amount}
      await this.render(kb, da, bi)
    }
  }
  bwarnUnknownUser = {
    show: async (target: string) => {
      const bi = Base.warnUnknownUser
      const kb = Helper.kb(this, bi)
      const da = {target}
      await this.render(kb, da, bi)
    }
  }
  bwarnSelf = {
    show: async () => {
      const bi = Base.warnSelf
      const kb = Helper.kb(this, bi)
      await this.render(kb, {}, bi)
    }
  }
  bwarnInsufficient = {
    show: async (balance: string) => {
      const bi = Base.warnInsufficient
      const kb = Helper.kb(this, bi)
      const da = {balance}
      await this.render(kb, da, bi)
    }
  }
  bsuccess = {
    show: async (amount: string, balance: string, target: string) => {
      await this.clearSession()
      const bi = Base.success
      const kb = Helper.kb(this, bi)
      const da = {amount, balance, target}
      await this.render(kb, da, bi)
    }
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
