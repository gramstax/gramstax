import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogData} from "~/data/catalog"
import {ItemListPage} from "./item-list"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: CategoryPage, edit = true) {
    const bi = Base.step1
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

  static async processStep1Answer(ctx: CategoryPage, categoryId: string) {
    await ctx.cacheState.set(`${ctx.userId}:category`, categoryId)
    await ctx.cacheState.set(`${ctx.userId}:page`, 0)
    await new ItemListPage(ctx).showStep1Form(categoryId, 0, true)
  }
}

// Category list page with dynamic inline buttons.
export class CategoryPage extends PageBase {
  static data = this.buildData({
    callbackData: (step: string, payload: string) => [step, payload],
    intentText: `Browse`
  })

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleText() {
    await Main.showStep1Form(this, false)
  }

  async handleArgsCallbackData() {
    const [step, categoryId] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, categoryId!)
    }
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        Choose a category to continue browsing.
      </g-message>
      ${this.kbk.back(`id`)}
      <g-message lang="id">
        Pilih kategori untuk melanjutkan browsing.
      </g-message>
    </g-base>
  `
}
