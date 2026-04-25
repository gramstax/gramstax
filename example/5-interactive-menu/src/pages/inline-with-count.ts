import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {BlankPage} from "./blank"
import {CatalogData} from "~/data/catalog"

class Base {
  static list: `list`
}

class Helper {
  static ITEMS_PER_PAGE = 4

  static kb(ctx: InlineWithCountPage, page: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / this.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * this.ITEMS_PER_PAGE
    const end = start + this.ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    return ctx.inlineKeyboard((k, l) => {
      const cb = ctx.data.callbackData.bind(ctx)
      items.forEach((item) => {
        k.text(item.name, cb(`item`, item.id)).row()
      })

      k.row()
      if (safePage > 0) {
        k.text(l[0]!, cb(`page`, safePage - 1))
      }
      k.text(`${l[2]} ${safePage + 1}/${totalPages}`, BlankPage.data.callbackData())
      if (safePage < totalPages - 1) {
        k.text(l[1]!, cb(`page`, safePage + 1))
      }
      return k.row().text(l[3]!, StartPage.data.callbackData())
    })
  }

  static pageData(page: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / this.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    return {page: safePage + 1, totalPages, safePage}
  }
}

class Perform {
  static async entryPoint(ctx: InlineWithCountPage, page: number, edit = true) {
    const {page: currentPage, totalPages, safePage} = Helper.pageData(page)
    const da = {page: currentPage, totalPages}
    const kb = Helper.kb(ctx, safePage)
    const bi = Base.list
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async process(ctx: InlineWithCountPage) {
    const [action, value] = ctx.callbackDataArgs
    if (!action) {
      return
    }

    if (action === `page`) {
      const nextPage = Number(value)
      if (!Number.isNaN(nextPage)) {
        await Perform.entryPoint(ctx, nextPage, true)
      }
      return
    }
    if (action === `item` && value) {
      return
    }
  }
}

// Inline keyboard with total page count.
export class InlineWithCountPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])

  async handleCallbackData() {
    await Perform.entryPoint(this, 0, true)
  }

  async handleArgsCallbackData() {
    await Perform.process(this)
  }

  static template = `
    <base>
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</keyboard>
      <message>
        📊 Inline Menu (With Count)

        Page {{page}}/{{totalPages}}

        Use Prev/Next to navigate, or tap Home to exit.
      </message>
    </base>

    <base id="${Base.list}">
      <message>
        Select an item from the inline menu to continue.
      </message>
    </base>
  `
}
