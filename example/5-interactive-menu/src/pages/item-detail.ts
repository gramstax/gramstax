import {PageBase} from "~/base/page"
import {CatalogMock} from "~/mock/catalog"
import {ItemListPage} from "./item-list"

// Item detail page with context-aware back button.
export class ItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  async callbackPayload() {
    const [action, categoryId, itemId] = this.callbackDataPayloads
    if (action !== `detail` || !categoryId || !itemId) return null

    const item = CatalogMock.getItemById(categoryId, itemId)
    const page = Number((await this.cacheState.get(`${this.userId}:page`)) || 0)
    const kb = this.inlineKeyboardT([ItemListPage.data.callback(`page`, `${page}`)])
    const da = {
      name: item?.name,
      description: item?.description
    }
    await this.edit(kb, da)
  }

  static template = `
    <base>
      <keyboard>Back to List</keyboard>
      <message>
        {~name || "Unknown"~}

        {~description || "No description found."~}
      </message>
    </base>
  `
}
