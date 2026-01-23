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
    return this.inlineKeyboard((k, a) => {
      items.forEach((item) => {
        k.text(item.name, this.data.callback(`item`, item.id)).row()
      })

      k.row()
      if (safePage > 0) {
        k.text(a[0]!, this.data.callback(`page`, safePage - 1))
      }
      k.text(`${a[2]} ${safePage + 1}/${totalPages}`, `_`)
      if (safePage < totalPages - 1) {
        k.text(a[1]!, this.data.callback(`page`, safePage + 1))
      }
      return k.row().text(a[3]!, StartPage.data.callback())
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
      <keyboard>Prev, Next, Page, ${this.kbl.home.default}</keyboard>
      <message>
        Inline Menu (With Count)

        Page {{page}}/{{totalPages}}
      </message>
    </base>

    <base id="${this.BASE.list}">
      <message>
        Select an item from the inline menu.
      </message>
    </base>
  `
}
