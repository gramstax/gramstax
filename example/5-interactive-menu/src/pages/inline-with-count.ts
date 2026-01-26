import {PageBase} from "~/base/page"
import {CatalogMock} from "~/mock/catalog"
import {StartPage} from "./start"

// Inline keyboard with total page count.
export class InlineWithCountPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])
  static BASE = {list: `list`}
  ITEMS_PER_PAGE = 4

  buildKb(page: number) {
    const totalPages = Math.max(Math.ceil(CatalogMock.menuItems.length / this.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * this.ITEMS_PER_PAGE
    const end = start + this.ITEMS_PER_PAGE
    const items = CatalogMock.menuItems.slice(start, end)
    return this.inlineKeyboard((k, l) => {
      const cb = this.data.callback.bind(this)
      items.forEach((item) => {
        k.text(item.name, cb(`item`, item.id)).row()
      })

      k.row()
      if (safePage > 0) {
        k.text(l[0]!, cb(`page`, safePage - 1))
      }
      k.text(`${l[2]} ${safePage + 1}/${totalPages}`, `_`)
      if (safePage < totalPages - 1) {
        k.text(l[1]!, cb(`page`, safePage + 1))
      }
      return k.row().text(l[3]!, StartPage.data.callback())
    })
  }

  async show(page: number, edit = true) {
    const totalPages = Math.max(Math.ceil(CatalogMock.menuItems.length / this.ITEMS_PER_PAGE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const data = {page: safePage + 1, totalPages}
    const kb = this.buildKb(safePage)
    const bi = InlineWithCountPage.BASE.list
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async callback() {
    await this.show(0, true)
  }

  async callbackPayload() {
    const [action, value] = this.callbackDataPayloads
    if (!action) return

    if (action === `page`) {
      const nextPage = Number(value)
      if (!Number.isNaN(nextPage)) await this.show(nextPage, true)
      return
    }
    if (action === `item` && value) return
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

    <base id="${this.BASE.list}">
      <message>
        Select an item from the inline menu to continue.
      </message>
    </base>
  `
}
