import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Deletes an existing todo item by selecting from inline keyboard list.
export class DeletePage extends PageBase {
  static data = this.buildData((action: string, itemId?: string) => [action, itemId])

  async callback() {
    const items = this.crudStore.listItems()
    if (items.length === 0) {
      const kb = this.inlineKeyboardT([StartPage])
      await this.edit(kb, {}, `empty`)
      return
    }

    const kb = this.inlineKeyboard((k, a) => {
      let builder = k.row()
      items.forEach((item, idx) => {
        builder = builder.text(`#${item.id} ${item.title.substring(0, 20)}`, this.data.callback(`delete`, `${item.id}`))
        if ((idx + 1) % 2 === 0) builder = builder.row()
      })
      builder = builder.row()
      return builder.text(a[0]!, StartPage.data.callback())
    })
    await this.edit(kb)
  }

  async callbackPayload() {
    const [action, idStr] = this.callbackDataPayloads
    if (action === `delete`) {
      const id = Number(idStr)
      if (!idStr || isNaN(id)) {
        const bi = `error`
        const kb = this.inlineKeyboardT([StartPage])
        return await this.edit(kb, {}, bi)
      }

      const deleted = this.crudStore.deleteItem(id)
      if (!deleted) {
        const bi = `notfound`
        const kb = this.inlineKeyboardT([StartPage], `1`, bi)
        return await this.edit(kb, {id}, bi)
      }

      const bi = `success`
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      const data = {
        id: String(deleted.id),
        title: deleted.title
      }
      await this.edit(kb, data, bi)
    }
  }

  static template = `
    <base>
      ${this.kbk.cancel()}
      <message>
        [-] Select Todos You Want Deleted
      </message>
    </base>

    <base id="empty">
      ${this.kbk.menu()}
      <message>
        📝 No Todos Found

        No todos to delete.

        Create your first todo to get started!
      </message>
    </base>

    <base id="success">
      ${this.kbk.menu()}
      <message>
        ✅ Todo Deleted!

        #{{id}} {{title}}

        This action cannot be undone.
      </message>
    </base>

    <base id="notfound">
      ${this.kbk.cancel()}
      <message>
        ❌ Todo Not Found

        Todo #{{idStr}} not found

        Check the ID and try again.
      </message>
    </base>

    <base id="error">
      ${this.kbk.cancel()}
      <message>
        ❌ Error

        {~code == 1 && "Invalid ID"~}

        Please try again.
      </message>
    </base>
  `
}
