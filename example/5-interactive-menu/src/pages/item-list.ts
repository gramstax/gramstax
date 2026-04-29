import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {ItemDetailPage} from "./item-detail"
import {CategoryPage} from "./category"

class Base {
  static list: `list`
}

class Helper {
  static kb(ctx: ItemListPage, categoryId: string, page: number, category = CatalogData.getCategoryById(categoryId)) {
    if (!category) {
      return ctx.inlineKeyboardT([CategoryPage])
    }

    const PAGE_SIZE = 3
    const totalPages = Math.max(Math.ceil(category.items.length / PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * PAGE_SIZE
    const end = start + PAGE_SIZE
    const items = category.items.slice(start, end)

    return ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(item.name, ItemDetailPage.data.callbackData(`detail`, categoryId, item.id))
          if (index % 2 === 1) k.row()
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(`page`, `${safePage - 1}`))
        }
        return k.row().text(l[2]!, CategoryPage.data.callbackData())
      },
      {baseId: Base.list}
    )
  }
}

class Main {
  static async showEntryPoint(ctx: ItemListPage, categoryId: string, page = 0, edit = true) {
    await ctx.cacheState.set(`${ctx.userId}:category`, categoryId)
    await ctx.cacheState.set(`${ctx.userId}:page`, page)

    const category = CatalogData.getCategoryById(categoryId)
    const categoryName = category?.name || `Unknown`

    const da = {category: categoryName}
    const kb = Helper.kb(ctx, categoryId, page, category)
    const bi = Base.list
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processDelegateOne(ctx: ItemListPage) {
    const categoryId = await ctx.cacheState.get(`${ctx.userId}:category`)
    if (!categoryId) {
      await this.processDelegateMissingCategory(ctx)
    } else {
      await Main.showEntryPoint(ctx, categoryId, 0, true)
    }
  }

  static async processDelegateTwo(ctx: ItemListPage) {
    const [action, value] = ctx.callbackDataArgs
    if (action !== `page`) {
      return await Main.processDelegateOne(ctx)
    }

    const categoryId = await ctx.cacheState.get(`${ctx.userId}:category`)
    if (!categoryId) {
      await this.processDelegateMissingCategory(ctx)
    } else {
      await Main.showEntryPoint(ctx, categoryId, Number(value), true)
    }
  }

  static async processDelegateMissingCategory(ctx: ItemListPage) {
    await new CategoryPage(ctx).entryPoint(true)
  }
}

// Item list with pagination and dynamic buttons.
export class ItemListPage extends PageBase {
  static data = this.buildData((action?: string, value?: string) => [action, value])

  async entryPoint(categoryId: string, page = 0, isEdit = true) {
    await Main.showEntryPoint(this, categoryId, page, isEdit)
  }

  async handleCallbackData() {
    await Main.processDelegateOne(this)
  }

  async handleArgsCallbackData() {
    await Main.processDelegateTwo(this)
  }

  static template = `
    <base>
      <keyboard>⬅️ Back to Categories</keyboard>
      <message>
        🧾 Catalog Items

        Choose an item to see full details.
      </message>
    </base>

    <base id="${Base.list}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.back.default}</keyboard>
      <message>
        📦 Items in {{category}}

        Use Prev/Next to navigate the list.
      </message>
    </base>
  `
}
