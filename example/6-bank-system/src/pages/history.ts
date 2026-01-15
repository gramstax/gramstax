import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows recent transaction history.
export class HistoryPage extends PageBase {
  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async callback() {
    const history = this.formatHistory()
    const kb = this.kb()
    const data = {history}
    await this.edit(kb, data)
  }

  private formatHistory() {
    const entries = this.bankStore.getHistory(this.userId)
    if (entries.length === 0) {
      return `No transactions available.`
    }
    return entries
      .map((entry) => {
        const amount = this.bankStore.formatAmount(this.bankStore.fromHex(entry.amountHex))
        const sign = entry.type === `deposit` || entry.type === `transfer-in` ? `+` : `-`
        const time = new Date(entry.ts).toISOString().replace(`T`, ` `).slice(0, 19)
        const peer = entry.peerName ? ` (${entry.peerName})` : ``
        const typeLabel = (() => {
          switch (entry.type) {
            case `deposit`:
              return `Deposit`
            case `withdraw`:
              return `Withdrawal`
            case `transfer-in`:
              return `Transfer In`
            case `transfer-out`:
              return `Transfer Out`
            default:
              return entry.type
          }
        })()
        return `${time} ${sign}${amount} ${typeLabel}${peer}`
      })
      .join(`\n`)
  }

  static template = `
    <base>
      <keyboard>Home</keyboard>
      <message>
        Recent transactions:

        {{history}}
      </message>
    </base>
  `
}
