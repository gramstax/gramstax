import {PageBase} from "~/base/page"
import {CatalogData} from "~/data/catalog"
import {BlankPage} from "~/pages/blank"
import {StartPage} from "~/pages/start"

const ITEMS_PER_PAGE = 4

class Helper {
  static kb(ctx: StartInlineWithoutRangePage, pageNo: number) {
    const safePage = Math.max(pageNo, 0)
    const start = safePage * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < CatalogData.menuItems.length
    return ctx.inlineKeyboard((k, l) => {
      items.forEach((item) => {
        k.text(item.name, ctx.data.callbackQueryData(`item`, item.id)).row()
      })

      k.row()
      if (hasPrevious) {
        k.text(l[0]!, ctx.data.callbackQueryData(`page`, String(safePage - 1)))
      }
      k.text(`${l[2]} ${safePage + 1}`, BlankPage)
      if (hasMore) {
        k.text(l[1]!, ctx.data.callbackQueryData(`page`, String(safePage + 1)))
      }
      return k.row().text(l[3]!, StartPage)
    })
  }

  static pageData(pageNo: number) {
    const safePage = Math.max(pageNo, 0)
    return {pageNo: safePage + 1, safePage}
  }
}

// Inline keyboard with page info (no total count).
export class StartInlineWithoutRangePage extends PageBase {
  static data = this.buildData((step?: string, action?: string, page?: string) => [step, action, page])

  async handleCallbackQueryData() {
    await this.bdefault.show(0)
  }

  async handleArgsCallbackQueryData() {
    const [action, value] = this.callbackQueryDataArgs
    await this.bdefault.process(action!, value!)
  }

  bdefault = {
    show: async (pageNo: number) => {
      const {pageNo: currentPage, safePage} = Helper.pageData(pageNo)
      const da = {pageNo: currentPage}
      const kb = Helper.kb(this, safePage)
      await this.renderAuto(kb, da)
    },
    process: async (action: string, value: string) => {
      if (action === `page`) {
        const nextPage = Number(value)
        if (!Number.isNaN(nextPage)) {
          await this.bdefault.show(nextPage)
        }
      } else if (action === `item` && value) {
        // ???
      }
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, 📄 Page, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, 📄 Halaman, ${this.kbl.home.id}</g-keyboard>
      <g-message>
        🧾 Inline Menu (Without Range (only count))

        Page {{pageNo}}

        Use Prev/Next to navigate, or tap Home to exit.
      </g-message>
      <g-message lang="id">
        🧾 Menu Inline (Tanpa Rentang (hanya hitungan))

        Halaman {{pageNo}}

        Gunakan Sebelumnya/Selanjutnya, atau ketuk Beranda untuk keluar.
      </g-message>
    </g-base>
  `
}
