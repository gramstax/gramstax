import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {StartPage} from "./start"
import {BlankPage} from "./blank"

class Base {
  static list: `list`
}

class Helper {
  static ITEMS_PER_PAGE = 4

  static kb(ctx: InlineWithoutCountPage, page: number) {
    const safePage = Math.max(page, 0)
    const start = safePage * this.ITEMS_PER_PAGE
    const end = start + this.ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < CatalogData.menuItems.length
    return ctx.inlineKeyboard((k, l) => {
      items.forEach((item) => {
        k.text(item.name, ctx.data.callbackData(`item`, item.id)).row()
      })

      k.row()
      if (hasPrevious) {
        k.text(l[0]!, ctx.data.callbackData(`page`, safePage - 1))
      }
      k.text(`${l[2]} ${safePage + 1}`, BlankPage.data.callbackData())
      if (hasMore) {
        k.text(l[1]!, ctx.data.callbackData(`page`, safePage + 1))
      }
      return k.row().text(l[3]!, StartPage.data.callbackData())
    })
  }

  static pageData(page: number) {
    const safePage = Math.max(page, 0)
    return {page: safePage + 1, safePage}
  }
}

class Perform {
  static async entryPoint(ctx: InlineWithoutCountPage, page: number, edit = true) {
    const {page: currentPage, safePage} = Helper.pageData(page)
    const da = {page: currentPage}
    const kb = Helper.kb(ctx, safePage)
    const bi = Base.list
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async delegate(ctx: InlineWithoutCountPage) {
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

// Inline keyboard with page info (no total count).
export class InlineWithoutCountPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])

  async handleCallbackData() {
    await Perform.entryPoint(this, 0, true)
  }

  async handleArgsCallbackData() {
    await Perform.delegate(this)
  }

  static template = `
    <base>
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</keyboard>
      <message>
        🧾 Inline Menu (Without Count)

        Page {{page}}

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
