import {PageBase} from "~/base/page"
import {StartBalancePage} from "./balance"
import {StartDepositPage} from "./deposit"
import {StartHistoryPage} from "./history"
import {StartTransferPage} from "./transfer"
import {StartWithdrawPage} from "./withdraw"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({keyboard: this.inlineKeyboardT([StartBalancePage, StartDepositPage, StartWithdrawPage, StartTransferPage, StartHistoryPage], `2`)})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">💳 Balance, ➕ Deposit, ➖ Withdraw, 🔁 Transfer, 📜 History</g-keyboard>
      <g-keyboard type="inline" lang="id">💳 Saldo, ➕ Setor, ➖ Tarik, 🔁 Transfer, 📜 Riwayat</g-keyboard>
      <g-message>
        💼 Banking Menu

        Manage your account with the actions below. Check your balance, move funds, or review recent activity at any time.
      </g-message>
      <g-message lang="id">
        💼 Menu Perbankan

        Kelola akun Anda dengan tindakan di bawah. Periksa saldo, pindahkan dana, atau tinjau aktivitas terbaru kapan saja.
      </g-message>
    </g-base>
  `
}
