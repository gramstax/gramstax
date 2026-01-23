import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {CrudItem} from "~/store/crud"

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((action?: string, query?: string, status?: string) => [action, query, status])
  PAGE_SIZE = 5

  async buildSelectKeyboard(page: number, items: CrudItem[]) {
    const allItems = await this.crudStore.listItems(this.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)

    return this.inlineKeyboard(
      (k, a) => {
        items.forEach((item, index) => {
          k.text(`📝 #${item.id} ${item.title.slice(0, 5)}..`, this.data.callback(`select`, item.id))
          if (index % 2 === 1) k.row()
        })

        k.row()
        if (safePage > 0) {
          k.text(a[0]!, this.data.callback(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(a[1]!, this.data.callback(`page`, `${safePage + 1}`))
        }
        return k.row().text(a[2]!, StartPage.data.callback())
      },
      {baseId: `select`}
    )
  }

  buildStatusKeyboard(id: string) {
    return this.inlineKeyboardT(
      [
        this.data.callback(`status`, id, `todo`), //
        this.data.callback(`status`, id, `in-progress`),
        this.data.callback(`status`, id, `done`),
        StartPage
      ],
      `3-1`,
      `status`
    )
  }

  async showSelect(page = 0, edit = true) {
    const allItems = await this.crudStore.listItems(this.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * this.PAGE_SIZE
    const end = start + this.PAGE_SIZE
    const items = allItems.slice(start, end)

    if (items.length === 0) {
      const bi = `empty`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      if (edit) await this.edit(kb, {}, bi)
      else await this.reply(kb, {}, bi)
      return
    }

    const kb = await this.buildSelectKeyboard(safePage, items)
    const bi = `select`
    const data = {count: allItems.length, page: safePage + 1, totalPages}
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async showStatus(id: string, edit = true) {
    const item = await this.crudStore.getItem(this.userId, id)
    if (!item) {
      const bi = `not-found`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      if (edit) await this.edit(kb, {id}, bi)
      else await this.reply(kb, {id}, bi)
      return
    }

    const kb = this.buildStatusKeyboard(id)
    const bi = `status`
    const data = {id: item.id, title: item.title, status: item.status}
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async callback() {
    await this.showSelect(0, true)
  }

  async callbackPayload() {
    const [action, query, status] = this.callbackDataPayloads
    if (action === `page`) {
      const page = Number(query)
      return await this.showSelect(page)
    }
    if (action === `select` && query) {
      return await this.showStatus(query, true)
    }
    if (action === `status` && query && status) {
      const item = await this.crudStore.getItem(this.userId, query)
      if (!item) {
        return await this.showSelect(0)
      }

      const updated = await this.crudStore.updateItem(this.userId, query, item.title, item.description, status as CrudItem[`status`])
      if (!updated) {
        return await this.showSelect(0)
      }
      const bi = `success`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      return await this.edit(kb, {id: updated.id, status: updated.status}, bi)
    }
    await this.showSelect(0, true)
  }

  static template = `
    <base id="select">
      <keyboard>⬅️ Prev, ➡️ Next, 🏠 Home</keyboard>
      <keyboard lang="id">⬅️ Sebelumnya, ➡️ Berikutnya, 🏠 Beranda</keyboard>
      <message>
        ✏️ Select a todo to update its status.

        Showing {{count}} items • Page {{page}}/{{totalPages}}
      </message>
      <message lang="id">
        ✏️ Pilih todo untuk memperbarui status.

        Menampilkan {{count}} item • Halaman {{page}}/{{totalPages}}
      </message>
    </base>

    <base id="status">
      <keyboard>📝 Todo, 🔄 In Progress, ✅ Done, 🏠 Home</keyboard>
      <keyboard lang="id">📝 Todo, 🔄 Proses, ✅ Selesai, 🏠 Beranda</keyboard>
      <message>
        📋 Item #{{id}}: {{title}}

        Current status: {{status}}

        Choose the next status:
      </message>
      <message lang="id">
        📋 Item #{{id}}: {{title}}

        Status saat ini: {{status}}

        Pilih status berikutnya:
      </message>
    </base>

    <base id="success">
      ${this.kbk.home()}
      <message>
        ✅ Status updated!

        Item #{{id}} is now: {{status}}
      </message>
      <message lang="id">
        ✅ Status diperbarui!

        Item #{{id}} sekarang: {{status}}
      </message>
    </base>

    <base id="empty">
      ${this.kbk.home()}
      <message>
        📭 No items available to update.

        Create some todos first to manage their status.
      </message>
      <message lang="id">
        📭 Tidak ada item untuk diperbarui.

        Buat beberapa todo terlebih dahulu.
      </message>
    </base>

    <base id="not-found">
      ${this.kbk.home()}
      <message>
        ❌ Item not found: {{id}}

        This item may have been deleted or doesn't exist.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus atau tidak ada.
      </message>
    </base>
  `
}
