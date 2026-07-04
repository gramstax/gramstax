import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {IVItem} from "~/db/db"

class Base {
  static index = `i`
  static success = `s`
  static errorNotFound = `e-notfound`
  static warnInvalid = `w-invalid`
  static infoEmpty = `i-empty`
}

class Helper {
  static MAX_ITEMS = 5

  static buildListKeyboard(ctx: DeletePage, items: IVItem[]) {
    const bi = Base.index
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(`🗑️ #${item.id} ${item.title.slice(0, 5)}..`, ctx.data.callbackData(bi, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })
        return k.row().text(l[0]!, StartPage.data.callbackData())
      },
      {AGBaseId: bi}
    )
    return kb
  }

  static buildHomeKeyboard(ctx: DeletePage, AGBaseId: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }
}

class Main {
  static async showIndexForm(ctx: DeletePage) {
    const getItems = await ctx.db.items.list(ctx.userId)
    const items = getItems.slice(0, Helper.MAX_ITEMS)
    if (items.length === 0) {
      await Main.showInfoEmpty(ctx)
    } else {
      const bi = Base.index
      const kb = Helper.buildListKeyboard(ctx, items)
      const da = {count: items.length}
      await ctx.setSessionFreeText({step: bi})
      await ctx.edit(kb, da, bi)
    }
  }

  static async processIndexForm(ctx: DeletePage, id: string, edit = false) {
    if (!id) {
      return await Main.showWarnInvalid(ctx, edit)
    }

    const deleted = await ctx.db.items.remove(ctx.userId, id)
    if (!deleted) {
      await Main.showErrorNotFound(ctx, id, edit)
    } else {
      await Main.showSuccess(ctx, id, edit)
    }
  }

  static async showSuccess(ctx: DeletePage, id: string, edit: boolean) {
    await ctx.clearSession()
    const bi = Base.success
    const da = {id}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showErrorNotFound(ctx: DeletePage, id: string, edit: boolean) {
    const bi = Base.errorNotFound
    const da = {id}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showWarnInvalid(ctx: DeletePage, edit: boolean) {
    const bi = Base.warnInvalid
    const da = {}
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showInfoEmpty(ctx: DeletePage) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

// Deletes an item by button or ID input.
export class DeletePage extends PageBase {
  static data = this.buildData((step?: string, id?: string) => [step, id])

  async handleCallbackData() {
    await Main.showIndexForm(this)
  }

  async handleArgsCallbackData() {
    const [step, id] = this.callbackDataArgs
    if (step === Base.index) {
      await Main.processIndexForm(this, id!, true)
    }
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params
    const input = this.msgText.trim()
    if (step === Base.index) {
      await Main.processIndexForm(this, input, false)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.home()}
      <g-message>
        🗑️ Select an item to delete, or type an ID.

        Showing {{count}} items. Deletions are permanent.
      </g-message>
      <g-message lang="id">
        🗑️ Pilih item untuk dihapus, atau ketik ID.

        Menampilkan {{count}} item. Penghapusan bersifat permanen.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Item deleted

        Removed item #{{id}} from your list. You can continue managing the remaining items.
      </g-message>
      <g-message lang="id">
        ✅ Item dihapus

        Item #{{id}} dihapus dari daftar. Anda dapat melanjutkan pengelolaan item lainnya.
      </g-message>
    </g-base>

    <g-base id="${Base.errorNotFound}">
      ${this.kbk.home()}
      <g-message>
        ❌ Item not found: {{id}}

        This item may have already been deleted or the ID is incorrect.
      </g-message>
      <g-message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus atau ID tidak sesuai.
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid ID

        Please send a numeric item ID (e.g., 1, 2, 3).
      </g-message>
      <g-message lang="id">
        ⚠️ ID tidak valid

        Mohon kirim ID item angka (mis. 1, 2, 3).
      </g-message>
    </g-base>

    <g-base id="${Base.infoEmpty}">
      ${this.kbk.home()}
      <g-message>
        📭 No items available to delete

        Create items first, then return here to delete them if needed.
      </g-message>
      <g-message lang="id">
        📭 Tidak ada item untuk dihapus

        Buat item terlebih dahulu, lalu kembali untuk menghapus bila perlu.
      </g-message>
    </g-base>
  `
}
