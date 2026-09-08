import {PageBase} from "~/base/page"
import {StartPage} from "."

class Helper {
  static formatHistory(ctx: StartHistoryPage) {
    const entries = ctx.bankStore.getHistory(ctx.from?.id)
    if (entries.length === 0) {
      return `No transactions available.`
    }

    return entries
      .map((entry) => {
        const amount = ctx.bankStore.formatAmount(ctx.bankStore.fromHex(entry.amountHex))
        const sign = entry.type === `deposit` || entry.type === `transfer-in` ? `+` : `-`
        const time = new Date(entry.ts).toISOString().replace(`T`, ` `).slice(0, 19)
        const peer = entry.peerName ? ` (@${entry.peerName})` : ``
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
}

// Shows recent transaction history.
export class StartHistoryPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      const history = Helper.formatHistory(this)
      const kb = this.inlineKeyboardT([StartPage])
      const da = {history}
      await this.renderAuto(kb, da)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        📜 Recent transactions

        {{history}}
      </g-message>
      <g-message lang="id">
        📜 Transaksi Terbaru

        {{history}}
      </g-message>
    </g-base>
  `
}
