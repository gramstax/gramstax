import {PageBase} from "~/base/page"
import {catalog} from "~/data/catalog"

const menuItems = catalog.flatMap((category) => category.items.map((item) => ({id: item.id, name: item.name, category: category.name})))
const menuItemMap = new Map(menuItems.map((item) => [item.id, item]))

// Inline keyboard with page info (no total count).
export class InlineWithoutCountPage extends PageBase {
  ITEMS_PER_PAGE = 4
  static data = this.buildData((page?: string) => page)

  buildKeyboard(page: number) {
    const safePage = Math.max(page, 0)
    const start = safePage * this.ITEMS_PER_PAGE
    const end = start + this.ITEMS_PER_PAGE
    const items = menuItems.slice(start, end)
    const hasPrevious = safePage > 0
    const hasMore = end < menuItems.length
    return this.ikb((k, a) => {
      items.forEach((item) => {
        k.text(item.name, this.data.callbackData(`item:${item.id}`)).row()
      })

      k.row()
      if (hasPrevious) {
        k.text(a[0]!, this.data.callbackData(`page:${safePage - 1}`))
      }
      k.text(`${a[2]} ${safePage + 1}`, `_`)
      if (hasMore) {
        k.text(a[1]!, this.data.callbackData(`page:${safePage + 1}`))
      }

      return k
    })
  }

  async show(page: number, isEdit = true) {
    const safePage = Math.max(page, 0)
    const kb = this.buildKeyboard(safePage)
    if (isEdit) {
      await this.edit(kb, {page: safePage + 1}, `list`)
      return
    }
    await this.reply(kb, {page: safePage + 1}, `list`)
  }

  async callback() {
    await this.show(0, true)
  }

  async callbackPayload() {
    const [action, value] = this.callbackDataPayloads
    if (!action) {
      return
    }
    if (action === `page`) {
      const nextPage = Number(value)
      if (!Number.isNaN(nextPage)) {
        await this.show(nextPage, true)
      }
      return
    }
    if (action === `item` && value) {
      return
    }
  }

  static template = `
    <base>
      <keyboard>Prev, Next, Page</keyboard>
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
