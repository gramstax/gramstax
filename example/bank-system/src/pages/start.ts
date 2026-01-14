import {PageBase} from "~/base/page"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"
import {HistoryPage} from "./history"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k
        .text(a[0]!, BalancePage.data.callback())
        .text(a[1]!, DepositPage.data.callback())
        .row()
        .text(a[2]!, WithdrawPage.data.callback())
        .text(a[3]!, TransferPage.data.callback())
        .row()
        .text(a[4]!, HistoryPage.data.callback())
    })
  }

  async textCommand() {
    const kb = this.kb()
    await this.reply(kb)
  }

  async callback() {
    const kb = this.kb()
    await this.edit(kb)
  }

  static template = `
    <base>
      <keyboard>Balance, Deposit, Withdraw, Transfer, History</keyboard>
      <message>
        Bank System Menu

        - Balance
        - Deposit
        - Withdraw
        - Transfer
        - History
      </message>
    </base>
  `
}
