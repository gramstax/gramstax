import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

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

class Main {
  static async showStep1Form(ctx: HistoryPage) {
    const history = Helper.formatHistory(ctx)
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {history}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: HistoryPage) {
    throw ctx
  }
}

// Shows recent transaction history.
export class HistoryPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        📜 Recent transactions

        {{history}}
      </g-message>
      ${this.kbk.back(`id`)}
      <g-message lang="id">
        📜 Transaksi Terbaru

        {{history}}
      </g-message>
    </g-base>
  `
}
