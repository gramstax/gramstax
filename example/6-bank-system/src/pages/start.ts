import {PageBase} from "~/base/page"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"
import {HistoryPage} from "./history"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k //
        .text(a[0]!, BalancePage.data.callback())
        .text(a[1]!, DepositPage.data.callback())
        .row()
        .text(a[2]!, WithdrawPage.data.callback())
        .text(a[3]!, TransferPage.data.callback())
        .row()
        .text(a[4]!, HistoryPage.data.callback())
    })
  }

  async core(isEdit: boolean) {
    const kb = this.kb()
    if (isEdit) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  async textCommand() {
    await this.core(false)
  }

  async callback() {
    await this.core(true)
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
