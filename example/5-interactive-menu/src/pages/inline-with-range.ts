import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {BlankPage} from "./blank"
import {CatalogData} from "~/data/catalog"

class Base {
  static step1 = `s1`
}

class Constant {
  static ITEMS_PER_PAGE = 4
}

class Helper {
  static kb(ctx: InlineWithRangePage, page: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / Constant.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * Constant.ITEMS_PER_PAGE
    const end = start + Constant.ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const bi = Base.step1
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item) => {
          k.text(item.name, ctx.data.callbackData(bi, `item`, item.id)).row()
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(bi, `page`, safePage - 1))
        }
        k.text(`${l[2]} ${safePage + 1}/${totalPages}`, BlankPage.data.callbackData())
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(bi, `page`, safePage + 1))
        }
        return k.row().text(l[3]!, StartPage.data.callbackData())
      },
      {baseId: bi}
    )
    return kb
  }

  static pageData(page: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / Constant.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    return {page: safePage + 1, totalPages, safePage}
  }
}

class Main {
  static async showStep1Form(ctx: InlineWithRangePage, page: number, edit = true) {
    const {page: currentPage, totalPages, safePage} = Helper.pageData(page)
    const bi = Base.step1
    const da = {page: currentPage, totalPages}
    const kb = Helper.kb(ctx, safePage)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: InlineWithRangePage, action: string, value?: string) {
    if (action === `page`) {
      const nextPage = Number(value)
      if (!isNaN(nextPage)) {
        await Main.showStep1Form(ctx, nextPage, true)
      }
    } else if (action === `item` && value) {
      // ???
    }
  }
}

// Inline keyboard with total page count.
export class InlineWithRangePage extends PageBase {
  static data = this.buildData((step?: string, action?: string, page?: string) => [step, action, page])

  async handleCallbackData() {
    await Main.showStep1Form(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [step, action, value] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, action!, value)
    }
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</keyboard>
      <message>
        📊 Inline Menu (With Count + Range)

        Page {{page}}/{{totalPages}}

        Use Prev/Next to navigate, or tap Home to exit.
      </message>
    </base>
  `
}
