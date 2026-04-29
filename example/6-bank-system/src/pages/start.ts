import {PageBase} from "~/base/page"
import {HistoryPage} from "./history"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"

class Main {
  static async showEntryPoint(ctx: StartPage, edit = true) {
    const kb = ctx.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`)
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showEntryPoint(this, false)
  }

  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
  }

  static template = `
    <base>
      <keyboard>💳 Balance, ➕ Deposit, ➖ Withdraw, 🔁 Transfer, 📜 History</keyboard>
      <message>
        💼 Banking Menu

        Manage your account with the actions below. Check your balance, move funds, or review recent activity at any time.
      </message>
    </base>
  `
}
