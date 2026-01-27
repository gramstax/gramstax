import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {TimeUt} from "~/utils/time"

// Lists all cached items.
export class ListPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])
  static BASE = {list: `list`, empty: `empty`}
  PAGE_SIZE = 5

  async handleCallbackData() {
    await this.show(0)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    if (action !== `page`) return await this.show(0)

    const nextPage = Number(value)
    await this.show(Number.isNaN(nextPage) ? 0 : nextPage)
  }

  async show(page = 0) {
    const {BASE} = ListPage
    const totalItems = await this.db.countItems(this.userId)
    if (totalItems === 0) {
      const bi = BASE.empty
      await this.edit(this.inlineKeyboardT([StartPage], `1`, bi), {}, bi)
    }

    const totalPages = Math.max(Math.ceil(totalItems / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const offset = safePage * this.PAGE_SIZE
    const items = await this.db.listItems(this.userId, {limit: this.PAGE_SIZE, offset})
    const list = items
      .map((item) => {
        const ts = TimeUt.formatTimestamp(item.updatedAt)
        return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
      })
      .join(`\n`)

    const bi = BASE.list
    const data = {items: list, page: safePage + 1, totalPages}
    await this.edit(this.buildKeyboard(safePage, totalPages), data, bi)
  }

  buildKeyboard(page: number, totalPages: number) {
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    return this.inlineKeyboard(
      (k, l) => {
        if (safePage > 0) {
          k.text(l[0]!, this.data.callbackdata(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, this.data.callbackdata(`page`, `${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackdata())
      },
      {baseId: ListPage.BASE.list}
    )
  }

  static template = `
    <base id="${this.BASE.list}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</keyboard>
      <keyboard lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</keyboard>
      <message>
        📋 Cached items

        Page {{page}}/{{totalPages}} • Browse and select an item by ID.

        {{items}}
      </message>
      <message lang="id">
        📋 Daftar item tersimpan

        Halaman {{page}}/{{totalPages}} • Pilih item berdasarkan ID.

        {{items}}
      </message>
    </base>

    <base id="${this.BASE.empty}">
      ${this.kbk.home()}
      <message>
        📭 No cached items yet.

        Start by creating your first item, then come back here to review it.
      </message>
      <message lang="id">
        📭 Belum ada item tersimpan.

        Mulailah dengan membuat item pertama, lalu kembali ke sini untuk melihatnya.
      </message>
    </base>
  `
}
