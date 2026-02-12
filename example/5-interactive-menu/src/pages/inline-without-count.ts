import {PageBase} from "~/base/page"
import {CatalogMock} from "~/mock/catalog"
import {StartPage} from "./start"
import {BlankPage} from "./blank"

// Inline keyboard with page info (no total count).
export class InlineWithoutCountPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])
  static BASE = {list: `list`}

  buildKb(page: number) {
    const ITEMS_PER_PAGE = 4
    const safePage = Math.max(page, 0)
    const start = safePage * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    const items = CatalogMock.menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < CatalogMock.menuItems.length
    return this.inlineKeyboard((k, l) => {
      items.forEach((item) => {
        k.text(item.name, this.data.callbackData(`item`, item.id)).row()
      })

      k.row()
      if (hasPrevious) {
        k.text(l[0]!, this.data.callbackData(`page`, safePage - 1))
      }
      k.text(`${l[2]} ${safePage + 1}`, BlankPage.data.callbackData())
      if (hasMore) {
        k.text(l[1]!, this.data.callbackData(`page`, safePage + 1))
      }
      return k.row().text(l[3]!, StartPage.data.callbackData())
    })
  }

  async show(page: number, edit = true) {
    const safePage = Math.max(page, 0)
    const data = {page: safePage + 1}
    const kb = this.buildKb(safePage)
    const bi = InlineWithoutCountPage.BASE.list
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async handleCallbackData() {
    await this.show(0, true)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
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
        🧾 Inline Menu (Without Count)

        Page {{page}}

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
