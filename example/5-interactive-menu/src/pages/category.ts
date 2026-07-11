import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Base {
  static index = `i`
}

class Main {
  static async showIndex(ctx: CategoryPage, edit = true) {
    const bi = Base.index
    const da = {}
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        CatalogData.list.forEach((category, index) => {
          k.text(category.name, ctx.data.callbackData(bi, category.id))
          if (index % 2 === 1) {
            k.row()
          }
        })
        return k.row().text(l[0]!, StartPage.data.callbackData())
      },
      {AGBaseId: bi}
    )
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processIndex(ctx: CategoryPage, categoryId: string) {
    await ctx.cacheState.set(`${ctx.userId}:category`, categoryId)
    await ctx.cacheState.set(`${ctx.userId}:page`, 0)
    await new ItemListPage(ctx).showIndex(categoryId, 0, true)
  }
}

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callbackData: (step: string, payload: string) => [step, payload],
    intentText: `Browse`
  })

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleText() {
    await Main.showIndex(this, false)
  }

  async handleArgsCallbackData() {
    const [step, categoryId] = this.callbackDataArgs
    if (step === Base.index) {
      await Main.processIndex(this, categoryId!)
    }
  }

  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.back()}
      <g-message>
        Choose a category to continue browsing.
      </g-message>
      <g-message lang="id">
        Pilih kategori untuk melanjutkan browsing.
      </g-message>
    </g-base>
  `
}
