import {PageBase} from "~/base/page"
import {CatalogData} from "~/labels/catalog"
import {StartPage} from "./start"

// Inline keyboard with page info (no total count).
export class InlineWithoutCountPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])

  buildKb(page: number) {
    const ITEMS_PER_PAGE = 4
    const safePage = Math.max(page, 0)
    const start = safePage * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    const items = CatalogData.menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < CatalogData.menuItems.length
    return this.inlineKeyboard((k, a) => {
      items.forEach((item) => {
        k.text(item.name, this.data.callback(`item`, item.id)).row()
      })

      k.row()
      if (hasPrevious) {
        k.text(a[0]!, this.data.callback(`page`, safePage - 1))
      }
      k.text(`${a[2]} ${safePage + 1}`, `_`)
      if (hasMore) {
        k.text(a[1]!, this.data.callback(`page`, safePage + 1))
      }
      return k.row().text(a[3]!, StartPage.data.callback())
    })
  }

  async show(page: number, edit = true) {
    const safePage = Math.max(page, 0)
    const data = {page: safePage + 1}
    const kb = this.buildKb(safePage)
    const bi = `list`
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
      <keyboard>Prev, Next, Page, ${this.kbl.home(`default`)}</keyboard>
      <message>
        Inline Menu (Without Count)

        Page {{page}}
      </message>
    </base>

    <base id="list">
      <message>
        Select an item from the inline menu.
      </message>
    </base>
  `
}
