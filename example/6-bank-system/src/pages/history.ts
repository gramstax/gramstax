import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static formatHistory(ctx: HistoryPage) {
    const entries = ctx.bankStore.getHistory(ctx.userId)
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

class Perform {
  static async entryPoint(ctx: HistoryPage) {
    const history = Helper.formatHistory(ctx)
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {history}
    await ctx.edit(kb, da)
  }
}

// Shows recent transaction history.
export class HistoryPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        📜 Recent transactions

        {{history}}
      </message>
    </base>
  `
}
