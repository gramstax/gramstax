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
      return `No transactions yet.`
    }
    return entries
      .map((entry) => {
        const amount = this.bankStore.formatAmount(this.bankStore.fromHex(entry.amountHex))
        const sign = entry.type === `deposit` || entry.type === `transfer-in` ? `+` : `-`
        const time = new Date(entry.ts).toISOString().replace(`T`, ` `).slice(0, 19)
        const peer = entry.peerName ? ` (${entry.peerName})` : ``
        return `${time} ${sign}${amount} ${entry.type}${peer}`
      })
      .join(`\n`)
  }

  static template = `
    <base>
      <keyboard>Back to Menu</keyboard>
      <message>
        Recent activity:
        
        {{history}}
      </message>
    </base>
  `
}
