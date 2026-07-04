import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {CategoryPage} from "./category"
import {ItemDetailPage} from "./item-detail"

class Base {
  static index = `i`
}

class Helper {
  static kb(ctx: ItemListPage, categoryId: string, page: number, category = CatalogData.getCategoryById(categoryId)) {
    const bi = Base.index
    if (!category) {
      const kb = ctx.inlineKeyboardT([CategoryPage], `1`, bi)
      return kb
    }

    const PAGE_SIZE = 3
    const totalPages = Math.max(Math.ceil(category.items.length / PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items = category.items.slice(start, end)
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(item.name, ItemDetailPage.data.callbackData(`detail`, categoryId, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(bi, `page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(bi, `page`, `${safePage - 1}`))
        }
        return k.row().text(l[2]!, CategoryPage.data.callbackData())
      },
      {AGBaseId: bi}
    )
    return kb
  }
}

class Main {
  static async showIndexForm(ctx: ItemListPage, categoryId: string, page = 0, edit = true) {
    await ctx.cacheState.set(`${ctx.userId}:category`, categoryId)
    await ctx.cacheState.set(`${ctx.userId}:page`, page)

    const category = CatalogData.getCategoryById(categoryId)
    const categoryName = category?.name || `Unknown`

    const da = {category: categoryName}
    const kb = Helper.kb(ctx, categoryId, page, category)
    const bi = Base.index
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processIndexAnswer(ctx: ItemListPage, page: number) {
    const categoryId = await ctx.cacheState.get(`${ctx.userId}:category`)
    if (!categoryId) {
      await new CategoryPage(ctx).showStep1Form(true)
    } else {
      await Main.showIndexForm(ctx, categoryId, page, true)
    }
  }
}

// Item list with pagination and dynamic buttons.
export class ItemListPage extends PageBase {
  static data = this.buildData((step: string, page: string) => [step, page])

  async handleArgsCallbackData() {
    const [step, page] = this.callbackDataArgs
    if (step === Base.index) {
      await Main.processIndexAnswer(this, Number(page))
    }
  }

  async showStep1Form(categoryId: string, page = 0, isEdit = true) {
    await Main.showIndexForm(this, categoryId, page, isEdit)
  }

  static template = `
    <g-base>
      <g-keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.back.id}</g-keyboard>
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
