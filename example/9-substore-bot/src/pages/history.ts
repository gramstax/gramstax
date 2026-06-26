import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"
import {type OrderRecord, OrderHistoryStore} from "~/data/store"

class Base {
  static step1 = `s1`
}

class Helper {
  static async getHistory(ctx: HistoryPage): Promise<OrderRecord[]> {
    return ((await ctx.cacheState.get(`${ctx.userId}:orders`)) ?? []) as OrderRecord[]
  }

  static async setHistory(ctx: HistoryPage, history: OrderRecord[]) {
    await ctx.cacheState.set(`${ctx.userId}:orders`, history)
  }

  static kb(ctx: HistoryPage, bi?: string) {
    return ctx.inlineKeyboardT([CatalogPage.data.callbackData(Base.step1, `page`, `0`), StartPage], `1`, bi)
  }
}

class Main {
  static async showStep1Form(ctx: HistoryPage, edit = true) {
    const history = OrderHistoryStore.refreshStatuses(await Helper.getHistory(ctx))
    await Helper.setHistory(ctx, history)
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {history: OrderHistoryStore.formatHistory(history)}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: HistoryPage) {
    throw ctx
  }
}

export class HistoryPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-message>
        🧾 Order History

        {{history}}

        We keep the latest 10 orders in this session-based example.
      </g-message>
      <g-keyboard lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message lang="id">
        🧾 Riwayat Pesanan

        {{history}}

        Kami menyimpan 10 pesanan terakhir dalam contoh berbasis sesi ini.
      </g-message>
    </g-base>
  `
}
