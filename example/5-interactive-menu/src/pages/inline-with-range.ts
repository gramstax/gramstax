import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {BlankPage} from "./blank"
import {CatalogData} from "~/data/catalog"

class Constant {
  static ITEMS_PER_PAGE = 4
}

class Helper {
  static kb(ctx: InlineWithRangePage, pageNo: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / Constant.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const start = safePage * Constant.ITEMS_PER_PAGE
    const end = start + Constant.ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const kb = ctx.inlineKeyboard((k, l) => {
      items.forEach((item) => {
        k.text(item.name, ctx.data.callbackData(`item`, item.id)).row()
      })

      k.row()
      if (safePage > 0) {
        k.text(l[0]!, ctx.data.callbackData(`page`, safePage - 1))
      }
      k.text(`${l[2]} ${safePage + 1}/${totalPages}`, BlankPage.data.callbackData())
      if (safePage < totalPages - 1) {
        k.text(l[1]!, ctx.data.callbackData(`page`, safePage + 1))
      }
      return k.row().text(l[3]!, StartPage.data.callbackData())
    })
    return kb
  }

  static pageData(pageNo: number) {
    const totalPages = Math.max(Math.ceil(CatalogData.menuItems.length / Constant.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    return {pageNo: safePage + 1, totalPages, safePage}
  }
}

class Main {
  static async showIndex(ctx: InlineWithRangePage, pageNo: number, isEdit = true) {
    const {pageNo: currentPage, totalPages, safePage} = Helper.pageData(pageNo)
    const da = {pageNo: currentPage, totalPages}
    const kb = Helper.kb(ctx, safePage)
    if (isEdit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async processIndex(ctx: InlineWithRangePage, action: string, value?: string) {
    if (action === `page`) {
      const nextPage = Number(value)
      if (!isNaN(nextPage)) {
        await Main.showIndex(ctx, nextPage, true)
      }
    } else if (action === `item` && value) {
      // ???
    }
  }
}

// Inline keyboard with total page count.
export class InlineWithRangePage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])

  async handleCallbackData() {
    await Main.showIndex(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    await Main.processIndex(this, action!, value)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard lang="id" type="inline">${this.kbl.prev.id}, ${this.kbl.next.id}, 📄 Halaman, ${this.kbl.home.id}</g-keyboard>
      <g-message>
        📊 Inline Menu (With Count + Range)

        Page {{pageNo}}/{{totalPages}}

        Use Prev/Next to navigate, or tap Home to exit.
      </g-message>
      <g-message lang="id">
        📊 Menu Inline (Dengan Hitungan + Rentang)

        Halaman {{pageNo}}/{{totalPages}}

        Gunakan Sebelumnya/Selanjutnya, atau ketuk Beranda untuk keluar.
      </g-message>
    </g-base>
  `
}
