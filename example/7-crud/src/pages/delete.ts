import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

// Deletes an item by button or ID input.
export class DeletePage extends PageBase {
  static data = this.buildData((action?: string, id?: string) => [action, id])
  static BASE = {list: `list`, success: `success`, notFound: `not-found`, invalid: `invalid`, empty: `empty`}
  MAX_ITEMS = 5

  async callback() {
    await this.sessionTextFree({step: `id`})
    await this.showList()
  }

  async callbackPayload() {
    const [action, id] = this.callbackDataPayloads
    if (action === `pick` && id) {
      return await this.handleDelete(id, true)
    }
    await this.showList()
  }

  async textFree() {
    if (!this.isSessionTextFree()) return null
    await this.sessionGet()
    await this.handleDelete(this.msgText, false)
  }

  buildListKeyboard(items: MainItem[]) {
    return this.inlineKeyboard(
      (k, a) => {
        items.forEach((item, index) => {
          k.text(`🗑️ #${item.id} ${item.title.slice(0, 5)}..`, this.data.callback(`pick`, item.id))
          if (index % 2 === 1) k.row()
        })
        return k.row().text(a[0]!, StartPage.data.callback())
      },
      {baseId: DeletePage.BASE.list}
    )
  }

  private buildSingleKeyboard(baseId: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private async sendWith(kb: ReturnType<PageBase[`inlineKeyboardT`]>, baseId: string, data: Record<string, unknown>, edit: boolean) {
    if (edit) await this.edit(kb, data, baseId)
    else await this.reply(kb, data, baseId)
  }

  private async showList() {
    const {BASE} = DeletePage
    const items = (await this.db.listItems(this.userId)).slice(0, this.MAX_ITEMS)
    if (items.length === 0) {
      const bi = BASE.empty
      return await this.edit(this.buildSingleKeyboard(bi), {}, bi)
    }
    await this.edit(this.buildListKeyboard(items), {count: items.length}, BASE.list)
  }

  private async handleDelete(input?: string, edit = false) {
    const {BASE} = DeletePage
    const id = input?.trim()
    if (!id) {
      await this.sessionClear()
      const bi = BASE.invalid
      return await this.sendWith(this.buildSingleKeyboard(bi), bi, {}, edit)
    }

    const deleted = this.db.deleteItem(this.userId, id)
    if (!deleted) {
      const bi = BASE.notFound
      return await this.sendWith(this.buildSingleKeyboard(bi), bi, {id}, edit)
    }
    await this.sessionClear()
    const bi = BASE.success
    await this.sendWith(this.buildSingleKeyboard(bi), bi, {id}, edit)
  }

  static template = `
    <base id="${this.BASE.list}">
      ${this.kbk.home()}
      <message>
        🗑️ Select an item to delete, or type an ID.

        Showing {{count}} items. Deletions are permanent.
      </message>
      <message lang="id">
        🗑️ Pilih item untuk dihapus, atau ketik ID.

        Menampilkan {{count}} item. Penghapusan bersifat permanen.
      </message>
    </base>

    <base id="${this.BASE.success}">
      ${this.kbk.home()}
      <message>
        ✅ Item deleted

        Removed item #{{id}} from your list. You can continue managing the remaining items.
      </message>
      <message lang="id">
        ✅ Item dihapus

        Item #{{id}} dihapus dari daftar. Anda dapat melanjutkan pengelolaan item lainnya.
      </message>
    </base>

    <base id="${this.BASE.notFound}">
      ${this.kbk.home()}
      <message>
        ❌ Item not found: {{id}}

        This item may have already been deleted or the ID is incorrect.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus atau ID tidak sesuai.
      </message>
    </base>

    <base id="${this.BASE.invalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid ID

        Please send a numeric item ID (e.g., 1, 2, 3).
      </message>
      <message lang="id">
        ⚠️ ID tidak valid

        Mohon kirim ID item angka (mis. 1, 2, 3).
      </message>
    </base>

    <base id="${this.BASE.empty}">
      ${this.kbk.home()}
      <message>
        📭 No items available to delete

        Create items first, then return here to delete them if needed.
      </message>
      <message lang="id">
        📭 Tidak ada item untuk dihapus

        Buat item terlebih dahulu, lalu kembali untuk menghapus bila perlu.
      </message>
    </base>
  `
}
