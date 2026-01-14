import {PageBase} from "~/base/page"
import {getItemById} from "~/data/catalog"
import {ItemListPage} from "./item-list"

// Item detail page with context-aware back button.
export class ItemDetailPage extends PageBase {
  static data = this.buildData((action?: string, categoryId?: string, itemId?: string) => [action, categoryId, itemId])

  kb(page: number) {
    return this.ikb((k, a) => {
      return k.text(a[0]!, ItemListPage.data.callback(`page`, `${page}`))
    })
  }

  async callbackPayload() {
    const [action, categoryId, itemId] = this.callbackDataPayloads
    if (action !== `detail` || !categoryId || !itemId) {
      return null
    }

    const item = getItemById(categoryId, itemId)
    const page = Number((await this.cacheState.get(`${this.userId}:page`)) || 0)
    const bi = `detail`
    const kb = this.kb(page)
    const da = {
      name: item?.name || `Unknown`,
      description: item?.description || `No description found.`
    }
    await this.edit(kb, da, bi)
  }

  static template = `
    <base>
      <keyboard>Back to List</keyboard>
      <message>
        {{name}}

        {{description}}
      </message>
    </base>

    <base id="detail">
      <message>
        {{name}}

        {{description}}
      </message>
    </base>
  `
}
