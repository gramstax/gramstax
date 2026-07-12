import {PageBase} from "~/base/page"
import {HistoryPage} from "./history"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    const kb = ctx.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">💳 Balance, ➕ Deposit, ➖ Withdraw, 🔁 Transfer, 📜 History</g-keyboard>
      <g-keyboard lang="id" type="inline">💳 Saldo, ➕ Setor, ➖ Tarik, 🔁 Transfer, 📜 Riwayat</g-keyboard>
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
