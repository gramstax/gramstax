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
    const items = this.crudStore.listItems(this.userId).slice(0, this.MAX_ITEMS)
    if (items.length === 0) {
      const kb = this.inlineKeyboardT([StartPage], `1`, `empty-kb`)
      const bi = `empty`
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
    const biInv = `invalid`
    if (!id) {
      const kb = this.inlineKeyboardT([StartPage], `1`, `${biInv}-kb`)
      if (edit) await this.edit(kb, {}, biInv)
      else await this.reply(kb, {}, biInv)
      return
    }

    const deleted = this.crudStore.deleteItem(this.userId, id)
    if (!deleted) {
      const bi = `not-found`
      const kb = this.inlineKeyboardT([StartPage], `1`, `${bi}-kb`)
      if (edit) await this.edit(kb, {id}, bi)
      else await this.reply(kb, {id}, bi)
      return
    }

    await this.sessionClear()
    const bi = `success`
    const kb = this.inlineKeyboardT([StartPage], `1`, `${bi}-kb`)
    if (edit) await this.edit(kb, {id}, bi)
    else await this.reply(kb, {id}, bi)
  }

  static template = `
    <base id="list">
      <message>
        🗑️ Select a todo to delete, or type an ID.

        Showing {{count}} items
      </message>
    </base>

    <base id="success">
      <message>
        ✅ Item deleted!

        Removed item #{{id}} from your todo list.
      </message>
    </base>

    <base id="not-found">
      <message>
        ❌ Item not found: {{id}}

        This item may have already been deleted.
      </message>
    </base>

    <base id="invalid">
      <message>
        ⚠️ Invalid ID.

        Please send a numeric item ID (e.g., 1, 2, 3).
      </message>
    </base>

    <base id="empty">
      <message>
        📭 No items available to delete.

        Create some todos first to manage them.
      </message>
    </base>

    <base id="list-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>

    <base id="success-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>

    <base id="not-found-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>

    <base id="invalid-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>

    <base id="empty-kb">
      <keyboard>${this.kbl.home.default}</keyboard>
    </base>
  `
}
