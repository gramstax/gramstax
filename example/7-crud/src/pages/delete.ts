import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

class Base {
  static list: `list`
  static success: `success`
  static errorNotFound: `e-notfound`
  static warnInvalid: `w-invalid`
  static infoEmpty: `i-empty`
}

class Helper {
  static MAX_ITEMS = 5

  static buildListKeyboard(ctx: DeletePage, items: MainItem[]) {
    return ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(`🗑️ #${item.id} ${item.title.slice(0, 5)}..`, ctx.data.callbackData(`pick`, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })
        return k.row().text(l[0]!, StartPage.data.callbackData())
      },
      {baseId: Base.list}
    )
  }

  static buildHomeKeyboard(ctx: DeletePage, baseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Alert {
  static async success(ctx: DeletePage, id: string, edit: boolean) {
    const bi = Base.success
    const da = {id}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async errorNotFound(ctx: DeletePage, id: string, edit: boolean) {
    const bi = Base.errorNotFound
    const da = {id}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async warnInvalid(ctx: DeletePage, edit: boolean) {
    const bi = Base.warnInvalid
    const da = {}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async infoEmpty(ctx: DeletePage) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: DeletePage) {
    const getItems = await ctx.db.listItems(ctx.userId)
    const items = getItems.slice(0, Helper.MAX_ITEMS)
    if (items.length === 0) {
      await Alert.infoEmpty(ctx)
    } else {
      const bi = Base.list
      const kb = Helper.buildListKeyboard(ctx, items)
      const da = {count: items.length}
      await ctx.edit(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: DeletePage, input?: string, edit = false) {
    const id = input?.trim()
    if (!id) {
      await ctx.clearSession()
      return await Alert.warnInvalid(ctx, edit)
    }

    const deleted = ctx.db.deleteItem(ctx.userId, id)
    if (!deleted) {
      return await Alert.errorNotFound(ctx, id, edit)
    }

    await ctx.clearSession()
    await Alert.success(ctx, id, edit)
  }
}

// Deletes an item by button or ID input.
export class DeletePage extends PageBase {
  static data = this.buildData((action?: string, id?: string) => [action, id])

  async handleCallbackData() {
    await this.sessionFreeText({step: `id`})
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    const [action, id] = this.callbackDataArgs
    if (action === `pick` && id) {
      await Main.processStep1Answer(this, id, true)
    } else {
      await Main.showStep1Form(this)
    }
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Main.processStep1Answer(this, this.msgText, false)
  }

  static template = `
    <base id="${Base.list}">
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

    <base id="${Base.success}">
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

    <base id="${Base.errorNotFound}">
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

    <base id="${Base.warnInvalid}">
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

    <base id="${Base.infoEmpty}">
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
