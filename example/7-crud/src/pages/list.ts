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
      {baseId: `navigation`}
    )
  }

  async show(page = 0, edit = true) {
    const items = this.crudStore.listItems(this.userId)
    if (items.length === 0) {
      const kb = this.inlineKeyboardT([StartPage], `1`, `empty-kb`)
      const bi = `empty`
      if (edit) await this.edit(kb, {}, bi)
      else await this.reply(kb, {}, bi)
      return
    }

    const totalPages = Math.max(Math.ceil(items.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * this.PAGE_SIZE
    const end = start + this.PAGE_SIZE
    const slice = items.slice(start, end)
    const list = slice
      .map((item) => {
        const ts = this.crudStore.formatTimestamp(item.updatedAt)
        return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
      })
      .join(`\n`)

    const kb = this.buildKeyboard(safePage, totalPages)
    const bi = `list`
    const data = {items: list, page: safePage + 1, totalPages}
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async callback() {
    await this.show(0, true)
  }

  async callbackPayload() {
    const [action, value] = this.callbackDataPayloads
    if (action !== `page`) return await this.show(0, true)
    const nextPage = Number(value)
    if (Number.isNaN(nextPage)) return await this.show(0, true)
    await this.show(nextPage, true)
  }

  static template = `
    <base id="list">
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
      <message>
        📭 No cached items yet.
        Use ➕ Create to add your first item.
      </message>
      <message lang="id">
        📭 Belum ada item tersimpan.
        Gunakan ➕ Buat untuk menambah item pertama.
      </message>
    </base>

    <base id="navigation">
      <keyboard>⬅️ Prev, ➡️ Next, 🏠 Home</keyboard>
      <keyboard lang="id">⬅️ Sebelumnya, ➡️ Berikutnya, 🏠 Beranda</keyboard>
    </base>

    <base id="empty-kb">
      ${this.kbk.home()}
    </base>
  `
}
