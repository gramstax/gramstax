import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Lists all cached items.
export class ListPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])
  PAGE_SIZE = 5

  buildKeyboard(page: number, totalPages: number) {
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    return this.inlineKeyboard(
      (k, a) => {
        if (safePage > 0) {
          k.text(a[0]!, this.data.callback(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(a[1]!, this.data.callback(`page`, `${safePage + 1}`))
        }
        return k.row().text(a[2]!, StartPage.data.callback())
      },
      {baseId: `list`}
    )
  }

  async show(page = 0) {
    const totalItems = await this.crudStore.countItems(this.userId)
    if (totalItems === 0) {
      const bi = `empty`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.edit(kb, {}, bi)
    }

    const totalPages = Math.max(Math.ceil(totalItems / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const offset = safePage * this.PAGE_SIZE
    const items = await this.crudStore.listItems(this.userId, {limit: this.PAGE_SIZE, offset})
    const list = items
      .map((item) => {
        const ts = this.crudStore.formatTimestamp(item.updatedAt)
        return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
      })
      .join(`\n`)

    const kb = this.buildKeyboard(safePage, totalPages)
    const bi = `list`
    const data = {items: list, page: safePage + 1, totalPages}
    await this.edit(kb, data, bi)
  }

  async callback() {
    await this.show(0)
  }

  async callbackPayload() {
    const [action, value] = this.callbackDataPayloads
    if (action !== `page`) return await this.show(0)

    const nextPage = Number(value)
    await this.show(Number.isNaN(nextPage) ? 0 : nextPage)
  }

  static template = `
    <base id="list">
      <keyboard>⬅️ Prev, ➡️ Next, 🏠 Home</keyboard>
      <keyboard lang="id">⬅️ Sebelumnya, ➡️ Berikutnya, 🏠 Beranda</keyboard>
      <message>
        📋 Cached items

        Page {{page}}/{{totalPages}}

        {{items}}
      </message>
      <message lang="id">
        📋 Daftar item tersimpan

        Halaman {{page}}/{{totalPages}}

        {{items}}
      </message>
    </base>

    <base id="empty">
      ${this.kbk.home()}
      <message>
        📭 No cached items yet.
        Use ➕ Create to add your first item.
      </message>
      <message lang="id">
        📭 Belum ada item tersimpan.
        Gunakan ➕ Buat untuk menambah item pertama.
      </message>
    </base>
  `
}
