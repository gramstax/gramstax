import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemDetailPage} from "./item-detail"
import {CategoryPage} from "./category"

// Item list with pagination and dynamic buttons.
export class ItemListPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])
  static BASE = {list: `list`}

  buildKeyboard(categoryId: string, page: number, category = CatalogData.getCategoryById(categoryId)) {
    if (!category) {
      return this.inlineKeyboardT([CategoryPage])
    }

    const PAGE_SIZE = 3
    const totalPages = Math.max(Math.ceil(category.items.length / PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items = category.items.slice(start, end)

    return this.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(item.name, ItemDetailPage.data.callbackData(`detail`, categoryId, item.id))
          if (index % 2 === 1) k.row()
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, this.data.callbackData(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, this.data.callbackData(`page`, `${safePage - 1}`))
        }
        return k.row().text(l[2]!, CategoryPage.data.callbackData())
      },
      {baseId: ItemListPage.BASE.list}
    )
  }

  async transition(categoryId: string, page = 0, isEdit = true) {
    await this.cacheState.set(`${this.userId}:category`, categoryId)
    await this.cacheState.set(`${this.userId}:page`, page)

    const category = CatalogData.getCategoryById(categoryId)
    const categoryName = category?.name || `Unknown`
    const da = {category: categoryName}
    const kb = this.buildKeyboard(categoryId, page, category)
    const bi = ItemListPage.BASE.list

    if (isEdit) await this.edit(kb, da, bi)
    else await this.reply(kb, da, bi)
  }

  async handleCallbackData() {
    const categoryId = await this.cacheState.get(`${this.userId}:category`)
    if (!categoryId) await new CategoryPage(this).transition(true)
    else await this.transition(categoryId, 0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    if (action !== `page`) {
      return await this.handleCallbackData()
    }

    const categoryId = await this.cacheState.get(`${this.userId}:category`)
    if (!categoryId) await new CategoryPage(this).transition(true)
    else await this.transition(categoryId, Number(value), true)
  }

  static template = `
    <base>
      <keyboard>⬅️ Back to Categories</keyboard>
      <message>
        🧾 Catalog Items

        Choose an item to see full details.
      </message>
    </base>

    <base id="${this.BASE.list}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.back.default}</keyboard>
      <message>
        📦 Items in {{category}}

        Use Prev/Next to navigate the list.
      </message>
    </base>
  `
}
