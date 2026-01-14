import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Shows recent transaction history.
export class HistoryPage extends PageBase {
  static data = this.buildData((payload?: string) => [payload])

  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    const history = this.formatHistory()

    if (isEdit) {
      await this.edit(this.kb(), {history}, `history`)
      return
    }

    await this.reply(this.kb(), {history}, `history`)
  }

  async textCommand() {
    await this.to(false)
  }

  async text() {
    await this.to(false)
  }

  async callback() {
    await this.to(true)
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

    <base id="history">
      <message>
        Recent activity:

        {{history}}
      </message>
    </base>
  `
}
