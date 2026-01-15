import {PageBase} from "~/base/page"
import {CatalogData} from "~/labels/catalog"
import {ItemDetailPage} from "./item-detail"
import {CategoryPage} from "./category"

// Item list with pagination and dynamic buttons.
export class ItemListPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  buildKeyboard(categoryId: string, page: number, category = CatalogData.getCategoryById(categoryId)) {
    if (!category) {
      return this.inlineKeyboard((k, a) => {
        return k.text(a[0]!, CategoryPage.data.callback())
      })
    }

    const PAGE_SIZE = 3
    const totalPages = Math.max(Math.ceil(category.items.length / PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items = category.items.slice(start, end)

    return this.inlineKeyboard(
      (k, a) => {
        items.forEach((item, index) => {
          k.text(item.name, ItemDetailPage.data.callback(`detail`, categoryId, item.id))
          if (index % 2 === 1) k.row()
        })

        k.row()
        if (safePage > 0) {
          k.text(a[0]!, this.data.callback(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(a[1]!, this.data.callback(`page`, `${safePage - 1}`))
        }
        return k.row().text(a[2]!, CategoryPage.data.callback())
      },
      {baseId: `navigation`}
    )
  }

  async to(categoryId: string, page = 0, isEdit = true) {
    await this.cacheState.set(`${this.userId}:category`, categoryId)
    await this.cacheState.set(`${this.userId}:page`, page)

    const category = CatalogData.getCategoryById(categoryId)
    const categoryName = category?.name || `Unknown`
    const da = {category: categoryName}
    const kb = this.buildKeyboard(categoryId, page, category)
    const bi = `list`

    if (isEdit) await this.edit(kb, da, bi)
    else await this.reply(kb, da, bi)
  }

  async callback() {
    const categoryId = await this.cacheState.get(`${this.userId}:category`)
    if (!categoryId) {
      await new CategoryPage(this).to(true)
    } else {
      await this.to(categoryId, 0, true)
    }
  }

  async callbackPayload() {
    const [action, value] = this.callbackDataPayloads
    if (action !== `page`) {
      await this.callback()
      return
    }

    const categoryId = await this.cacheState.get(`${this.userId}:category`)
    if (!categoryId) {
      await new CategoryPage(this).to(true)
    } else {
      await this.to(categoryId, Number(value), true)
    }
  }

  static template = `
    <base>
      <keyboard>Back to Categories</keyboard>
      <message>
        Choose an item from the catalog.
      </message>
    </base>

    <base id="list">
      <message>
        Items in {{category}}:
      </message>
    </base>

    <base id="navigation">
      <keyboard>Prev, Next, Back</keyboard>
    </base>
  `
}
