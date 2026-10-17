import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {StartItemListPage} from "./list"

// Item detail page with context-aware back button.
export class StartItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  async handleArgsCallbackQueryData() {
    const [action, categoryId, itemId] = this.callbackQueryDataArgs
    if (action !== `detail` || !categoryId || !itemId) {
      return
    }
    await this.gdefault.show(categoryId!, itemId!)
  }

  helper = {}
  gdefault = {
    show: async (categoryId: string, itemId: string) => {
      const item = CatalogData.getItemById(categoryId, itemId)
      const getPage = await this.cacheState.get(`${this.from!.id}:page`)
      const page = Number(getPage ?? 0)
      await this.renderText({keyboard: this.inlineKeyboardT([StartItemListPage.data.callbackQueryData(`${page}`)], `1`), data: {name: item?.name, description: item?.description}})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">⬅️ Back to List</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali ke Daftar</g-keyboard>
      <g-message>
        📌 <g-ifelse>name || "Unknown"</g-ifelse>

        <g-ifelse>description || "No description found."</g-ifelse>
      </g-message>
      <g-message lang="id">
        📌 <g-ifelse>name || "Tidak dikenal"</g-ifelse>

        <g-ifelse>description || "Tidak ada deskripsi."</g-ifelse>
      </g-message>
    </g-base>
  `
}
