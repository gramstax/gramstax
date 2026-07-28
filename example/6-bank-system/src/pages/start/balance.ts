import {PageBase} from "~/base/page"
import {StartPage} from "."

// Shows the current user balance.
export class StartBalancePage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const balance = this.bankStore.getBalance(this.from!.id)
      const formatted = this.bankStore.formatAmount(balance)
      const da = {balance: formatted}
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderEdit(kb, da)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        💳 Account balance

        Available balance: {{balance}}

        Use the menu to deposit, withdraw, or transfer funds.
      </g-message>
      <g-message lang="id">
        💳 Saldo Akun

        Saldo tersedia: {{balance}}

        Gunakan menu untuk menyetor, menarik, atau mentransfer dana.
      </g-message>
    </g-base>
  `
}
