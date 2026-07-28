import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {StartCategoryPage} from "../category"
import {StartItemDetailPage} from "./detail"

class Helper {
  static kb(ctx: StartItemListPage, categoryId: string, pageNo: number, category = CatalogData.getCategoryById(categoryId)) {
    if (!category) {
      return ctx.inlineKeyboardT([StartCategoryPage])
    }

    const PAGE_SIZE = 3
    const totalPages = Math.max(Math.ceil(category.items.length / PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const start = safePage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items = category.items.slice(start, end)
    return ctx.inlineKeyboard((k, l) => {
      items.forEach((item, index) => {
        k.text(item.name, StartItemDetailPage.data.callbackQueryData(`detail`, categoryId, item.id))
        if (index % 2 === 1) {
          k.row()
        }
      })

      k.row()
      if (safePage > 0) {
        k.text(l[0]!, ctx.data.callbackQueryData(`page`, `${safePage - 1}`))
      }
      if (safePage < totalPages - 1) {
        k.text(l[1]!, ctx.data.callbackQueryData(`page`, `${safePage - 1}`))
      }
      return k.row().text(l[2]!, StartCategoryPage.data.callbackQueryData())
    })
  }
}

// Item list with pagination and dynamic buttons.
export class StartItemListPage extends PageBase {
  static data = this.buildData((pageNo: string) => [pageNo])

  async handleArgsCallbackQueryData() {
    const pageNo = this.callbackQueryDataArg
    await this.bdefault.process(pageNo)
  }

  bdefault = {
    show: async (categoryId: string, pageNo = 0, isEdit = true) => {
      await this.cacheState.set(`${this.from!.id}:category`, categoryId)
      await this.cacheState.set(`${this.from!.id}:page`, pageNo)
      const category = CatalogData.getCategoryById(categoryId)
      const categoryName = category?.name || `Unknown`

      const da = {category: categoryName}
      const kb = Helper.kb(this, categoryId, pageNo, category)
      await this.renderAuto(kb, da, null, null, isEdit)
    },
    process: async (pageNo: string) => {
      const categoryId = await this.cacheState.get(`${this.from!.id}:category`)
      if (!categoryId) {
        await new StartCategoryPage(this).bdefault.show(true)
      } else {
        await this.bdefault.show(categoryId, Number(pageNo), true)
      }
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        📦 Items in {{category}}

        Use Prev/Next to navigate the list.
      </g-message>
      <g-message lang="id">
        📦 Item di {{category}}

        Gunakan Sebelumnya/Selanjutnya untuk menavigasi daftar.
      </g-message>
    </g-base>
  `
}
