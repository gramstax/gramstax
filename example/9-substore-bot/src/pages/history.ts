import {PageBase} from "~/base/page"
import {OrderHistoryStore, type OrderRecord} from "~/data/store"
import {CatalogPage} from "./catalog"
import {StartPage} from "./start"

export class HistoryPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  async handleCommandText() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const raw = ((await this.cacheState.get(`${this.from!.id}:orders`)) ?? []) as OrderRecord[]
      const history = OrderHistoryStore.refreshStatuses(raw)
      await this.cacheState.set(`${this.from!.id}:orders`, history)

      const kb = this.inlineKeyboardT([CatalogPage, StartPage], `1`)
      const da = {history: OrderHistoryStore.formatHistory(history)}
      await this.renderAuto(kb, da)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
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
