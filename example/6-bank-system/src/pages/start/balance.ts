import {PageBase} from "~/base/page"
import {StartPage} from "."

// Shows the current user balance.
export class StartBalancePage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const balance = this.bankStore.getBalance(this.from!.id)
      const formatted = this.bankStore.formatAmount(balance)
      await this.renderText({keyboard: this.inlineKeyboardT([StartPage]), data: {balance: formatted}})
    },
    process: () => {}
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
