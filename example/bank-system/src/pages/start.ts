import {PageBase} from "~/base/page"
import {BalancePage} from "./balance"
import {DepositPage} from "./deposit"
import {WithdrawPage} from "./withdraw"
import {TransferPage} from "./transfer"
import {HistoryPage} from "./history"

// Main menu page for the bank system bot.
export class StartPage extends PageBase {
  static data = this.buildData((action?: string) => (action ? [action] : []))

  kb() {
    return this.ikb((k, a) => {
      return k
        .text(a[0]!, this.data.callback(`balance`))
        .text(a[1]!, this.data.callback(`deposit`))
        .row()
        .text(a[2]!, this.data.callback(`withdraw`))
        .text(a[3]!, this.data.callback(`transfer`))
        .row()
        .text(a[4]!, this.data.callback(`history`))
    })
  }

  async showMenu(isEdit = false) {
    if (isEdit) {
      await this.edit(this.kb(), {}, `menu`)
      return
    }

    await this.reply(this.kb(), {}, `menu`)
  }

  async textCommand() {
    await this.showMenu(false)
  }

  async callback() {
    await this.showMenu(true)
  }

  async callbackPayload() {
    const action = this.callbackDataPayload
    if (!action) {
      await this.showMenu(true)
      return
    }

    if (action === `balance`) {
      await new BalancePage(this).to(true)
      return
    }

    if (action === `deposit`) {
      await new DepositPage(this).to(true)
      return
    }

    if (action === `withdraw`) {
      await new WithdrawPage(this).to(true)
      return
    }

    if (action === `transfer`) {
      await new TransferPage(this).to(true)
      return
    }

    if (action === `history`) {
      await new HistoryPage(this).to(true)
    }
  }

  static template = `
    <base>
      <keyboard>Balance, Deposit, Withdraw, Transfer, History</keyboard>
      <message>
        Bank System

        Choose an action from the inline menu.
      </message>
    </base>

    <base id="menu">
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
