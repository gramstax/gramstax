import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

// Item detail page with context-aware back button.
export class ItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  async handleArgsCallbackData() {
    const [action, categoryId, itemId] = this.callbackDataArgs
    if (action !== `detail` || !categoryId || !itemId) {
      return
    }
    await this.bdefault.show(categoryId!, itemId!)
  }

  bdefault = {
    show: async (categoryId: string, itemId: string) => {
      const item = CatalogData.getItemById(categoryId, itemId)
      const getPage = await this.cacheState.get(`${this.userId}:page`)
      const page = Number(getPage ?? 0)
      const kb = this.inlineKeyboardT([ItemListPage.data.callbackData(`${page}`)], `1`)
      const da = {
        name: item?.name,
        description: item?.description
      }
      await this.edit(kb, da)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">⬅️ Back to List</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali ke Daftar</g-keyboard>
      <g-message>
        📌 {~name || "Unknown"~}

        {~description || "No description found."~}
      </g-message>
      <g-message lang="id">
        📌 {~name || "Tidak dikenal"~}

        {~description || "Tidak ada deskripsi."~}
      </g-message>
    </g-base>
  `
}
