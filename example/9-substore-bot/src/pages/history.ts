import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"
import {type OrderRecord, OrderHistoryStore} from "~/data/store"

export class HistoryPage extends PageBase {
  async handleCallbackData() {
    await this.bdefault.show(true)
  }

  async handleCommandText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const raw = ((await this.cacheState.get(`${this.userId}:orders`)) ?? []) as OrderRecord[]
      const history = OrderHistoryStore.refreshStatuses(raw)
      await this.cacheState.set(`${this.userId}:orders`, history)

      const kb = this.inlineKeyboardT([CatalogPage, StartPage], `1`)
      const da = {history: OrderHistoryStore.formatHistory(history)}
      if (isEdit) {
        await this.edit(kb, da)
      } else {
        await this.reply(kb, da)
      }
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
