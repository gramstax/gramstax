import {PageBase} from "~/base/page"
import {HistoryPage} from "./history"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  async handleCommandText() {
    await this.bdefault.show(false)
  }

  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`)
      await this.renderAuto(kb, null, null, null, isEdit)
    }
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
