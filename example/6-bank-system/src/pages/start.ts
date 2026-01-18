import {PageBase} from "~/base/page"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"
import {HistoryPage} from "./history"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  async show(edit: boolean) {
    const kb = this.inlineKeyboardT([BalancePage, DepositPage, WithdrawPage, TransferPage, HistoryPage], `2`)
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async textCommand() {
    await this.show(false)
  }

  async callback() {
    await this.show(true)
  }

  static template = `
    <base>
      <keyboard>Balance, Deposit, Withdraw, Transfer, History</keyboard>
      <message>
        Banking Menu

        Select a service below to manage your account. You can review balances, move funds, or view recent activity.

        - Balance
        - Deposit
        - Withdraw
        - Transfer
        - History
      </message>
    </base>
  `
}
