import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"
import {type OrderRecord, OrderHistoryStore} from "~/data/store"

class Helper {
  static async getHistory(ctx: HistoryPage): Promise<OrderRecord[]> {
    return ((await ctx.cacheState.get(`${ctx.userId}:orders`)) ?? []) as OrderRecord[]
  }

  static async setHistory(ctx: HistoryPage, history: OrderRecord[]) {
    await ctx.cacheState.set(`${ctx.userId}:orders`, history)
  }

  static kb(ctx: HistoryPage) {
    return ctx.inlineKeyboardT([CatalogPage, StartPage], `1`)
  }
}

class Main {
  static async showIndex(ctx: HistoryPage, edit = true) {
    const history = OrderHistoryStore.refreshStatuses(await Helper.getHistory(ctx))
    await Helper.setHistory(ctx, history)

    const kb = ctx.inlineKeyboardT([CatalogPage, StartPage], `1`)
    const da = {history: OrderHistoryStore.formatHistory(history)}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class HistoryPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  static template = `
    <g-base>
      <g-keyboard>🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message>
        🧾 Order History

        {{history}}

        We keep the latest 10 orders in this session-based example.
      </g-message>
      <g-message lang="id">
        🧾 Riwayat Pesanan

        {{history}}

        Kami menyimpan 10 pesanan terakhir dalam contoh berbasis sesi ini.
      </g-message>
    </g-base>
  `
}
