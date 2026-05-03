import {PageBase} from "~/base/page"
import {HistoryPage} from "./history"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
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
    <base id="${Base.index}">
      <keyboard>💳 Balance, ➕ Deposit, ➖ Withdraw, 🔁 Transfer, 📜 History</keyboard>
      <message>
        💼 Banking Menu

        Manage your account with the actions below. Check your balance, move funds, or review recent activity at any time.
      </message>
    </base>
  `
}
