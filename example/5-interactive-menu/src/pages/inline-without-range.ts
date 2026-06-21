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
  static kb(ctx: InlineWithoutRangePage, page: number) {
    const safePage = Math.max(page, 0)
    const start = safePage * Constant.ITEMS_PER_PAGE
    const end = start + Constant.ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < CatalogData.menuItems.length
    const bi = Base.step1
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item) => {
          k.text(item.name, ctx.data.callbackData(bi, `item`, item.id)).row()
        })

        k.row()
        if (hasPrevious) {
          k.text(l[0]!, ctx.data.callbackData(bi, `page`, safePage - 1))
        }
        k.text(`${l[2]} ${safePage + 1}`, BlankPage.data.callbackData())
        if (hasMore) {
          k.text(l[1]!, ctx.data.callbackData(bi, `page`, safePage + 1))
        }
        return k.row().text(l[3]!, StartPage.data.callbackData())
      },
      {AGBaseId: bi}
    )
    return kb
  }

  static pageData(page: number) {
    const safePage = Math.max(page, 0)
    return {page: safePage + 1, safePage}
  }
}

class Main {
  static async showStep1Form(ctx: InlineWithoutRangePage, page: number, edit = true) {
    const {page: currentPage, safePage} = Helper.pageData(page)
    const da = {page: currentPage}
    const kb = Helper.kb(ctx, safePage)
    const bi = Base.step1
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: InlineWithoutRangePage, action: string, value?: string) {
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

// Inline keyboard with page info (no total count).
export class InlineWithoutRangePage extends PageBase {
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
    <g-base id="${Base.step1}">
      <g-keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</g-keyboard>
      <g-message>
        🧾 Inline Menu (Without Range (only count))

        Page {{page}}

        Use Prev/Next to navigate, or tap Home to exit.
      </g-message>
    </g-base>
  `
}
