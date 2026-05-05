import {PageBase} from "~/base/page"
import {HistoryPage} from "./history"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>💳 Balance, ➕ Deposit, ➖ Withdraw, 🔁 Transfer, 📜 History</keyboard>
      <message>
        💼 Banking Menu

        Manage your account with the actions below. Check your balance, move funds, or review recent activity at any time.
      </message>
    </base>
  `
}
