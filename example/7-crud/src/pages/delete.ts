import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {CrudItem} from "~/store/crud"

// Deletes an item by button or ID input.
export class DeletePage extends PageBase {
  static data = this.buildData((action?: string, id?: string) => [action, id])
  MAX_ITEMS = 5

  buildListKeyboard(items: CrudItem[]) {
    return this.inlineKeyboard(
      (k, a) => {
        items.forEach((item, index) => {
          k.text(`🗑️ #${item.id} ${item.title}`, this.data.callback(`pick`, item.id))
          if (index % 2 === 1) k.row()
        })
        return k.row().text(a[0]!, StartPage.data.callback())
      },
      {baseId: `list-kb`}
    )
  }

  async showList(edit = true) {
    const items = (await this.crudStore.listItems(this.userId)).slice(0, this.MAX_ITEMS)
    if (items.length === 0) {
      const bi = `empty`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      if (edit) await this.edit(kb, {}, bi)
      else await this.reply(kb, {}, bi)
      return
    }

    const kb = this.buildListKeyboard(items)
    const bi = `list`
    const data = {count: items.length}
    if (edit) await this.edit(kb, data, bi)
    else await this.reply(kb, data, bi)
  }

  async callback() {
    await this.sessionTextFree({step: `id`})
    await this.showList(true)
  }

  async callbackPayload() {
    const [action, id] = this.callbackDataPayloads
    if (action === `pick` && id) {
      await this.handleDelete(id, true)
      return
    }

    await this.showList(true)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    await this.sessionGet()
    await this.handleDelete(this.msgText, false)
  }

  private async handleDelete(input?: string, edit = false) {
    const id = input?.trim()
    if (!id) {
      const bi = `invalid`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      if (edit) await this.edit(kb, {}, bi)
      else await this.reply(kb, {}, bi)
      await this.sessionClear()
      return
    }

    const deleted = this.crudStore.deleteItem(this.userId, id)
    if (!deleted) {
      const bi = `not-found`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      if (edit) await this.edit(kb, {id}, bi)
      else await this.reply(kb, {id}, bi)
      return
    }

    await this.sessionClear()
    const bi = `success`
    const kb = this.inlineKeyboardT([StartPage], `1`, bi)
    if (edit) await this.edit(kb, {id}, bi)
    else await this.reply(kb, {id}, bi)
  }

  static template = `
    <base id="list">
      ${this.kbk.home()}
      <message>
        🗑️ Select a todo to delete, or type an ID.

        Showing {{count}} items
      </message>
      <message lang="id">
        🗑️ Pilih todo untuk dihapus, atau ketik ID.

        Menampilkan {{count}} item
      </message>
    </base>

    <base id="success">
      ${this.kbk.home()}
      <message>
        ✅ Item deleted!

        Removed item #{{id}} from your todo list.
      </message>
      <message lang="id">
        ✅ Item dihapus!

        Item #{{id}} dihapus dari daftar todo.
      </message>
    </base>

    <base id="not-found">
      ${this.kbk.home()}
      <message>
        ❌ Item not found: {{id}}

        This item may have already been deleted.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus.
      </message>
    </base>

    <base id="invalid">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid ID.

        Please send a numeric item ID (e.g., 1, 2, 3).
      </message>
      <message lang="id">
        ⚠️ ID tidak valid.

        Mohon kirim ID item angka (mis. 1, 2, 3).
      </message>
    </base>

    <base id="empty">
      ${this.kbk.home()}
      <message>
        📭 No items available to delete.

        Create some todos first to manage them.
      </message>
      <message lang="id">
        📭 Tidak ada item untuk dihapus.

        Buat beberapa todo terlebih dahulu.
      </message>
    </base>
  `
}
