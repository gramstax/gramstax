import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((action?: string, query?: string, status?: string) => [action, query, status])
  static BASE = {select: `select`, status: `status`, success: `success`, empty: `empty`, notFound: `not-found`}
  PAGE_SIZE = 5

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
      const item = await this.db.getItem(this.userId, query)
      if (!item) {
        return await this.showSelect(0)
      }

      const updated = await this.db.updateItem(this.userId, query, item.title, item.description, status as MainItem[`status`])
      if (!updated) {
        return await this.showSelect(0)
      }
      const bi = UpdatePage.BASE.success
      return await this.sendWith(this.buildSingleKeyboard(bi), bi, {id: updated.id, status: updated.status}, true)
    }
    await this.showSelect(0, true)
  }

  async showSelect(page = 0, edit = true) {
    const {BASE} = UpdatePage
    const allItems = await this.db.listItems(this.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * this.PAGE_SIZE
    const end = start + this.PAGE_SIZE
    const items = allItems.slice(start, end)

    if (items.length === 0) {
      const bi = BASE.empty
      return await this.sendWith(this.buildSingleKeyboard(bi), bi, {}, edit)
    }

    const data = {count: allItems.length, page: safePage + 1, totalPages}
    await this.sendWith(await this.buildSelectKeyboard(safePage, items), BASE.select, data, edit)
  }

  async showStatus(id: string, edit = true) {
    const {BASE} = UpdatePage
    const item = await this.db.getItem(this.userId, id)
    if (!item) {
      const bi = BASE.notFound
      return await this.sendWith(this.buildSingleKeyboard(bi), bi, {id}, edit)
    }
    const data = {id: item.id, title: item.title, status: item.status}
    await this.sendWith(this.buildStatusKeyboard(id), BASE.status, data, edit)
  }

  async buildSelectKeyboard(page: number, items: MainItem[]) {
    const allItems = await this.db.listItems(this.userId)
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
      {baseId: UpdatePage.BASE.select}
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
      UpdatePage.BASE.status
    )
  }

  private buildSingleKeyboard(baseId: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private async sendWith(kb: ReturnType<PageBase[`inlineKeyboardT`]>, baseId: string, data: Record<string, unknown>, edit: boolean) {
    if (edit) await this.edit(kb, data, baseId)
    else await this.reply(kb, data, baseId)
  }

  static template = `
    <base id="${this.BASE.select}">
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

    <base id="${this.BASE.status}">
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

    <base id="${this.BASE.success}">
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

    <base id="${this.BASE.empty}">
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

    <base id="${this.BASE.notFound}">
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
