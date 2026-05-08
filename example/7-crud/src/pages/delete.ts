import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

class Base {
  static step1 = `s1`
  static success = `s`
  static errorNotFound = `e-notfound`
  static warnInvalid = `w-invalid`
  static infoEmpty = `i-empty`
}

class Helper {
  static MAX_ITEMS = 5

  static buildListKeyboard(ctx: DeletePage, items: MainItem[]) {
    const bi = Base.step1
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
      {baseId: bi}
    )
    return kb
  }

  static buildHomeKeyboard(ctx: DeletePage, baseId: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }
}

class Alert {
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

class Main {
  static async showStep1Form(ctx: DeletePage) {
    const getItems = await ctx.db.listItems(ctx.userId)
    const items = getItems.slice(0, Helper.MAX_ITEMS)
    if (items.length === 0) {
      await Alert.showInfoEmpty(ctx)
    } else {
      const bi = Base.step1
      const kb = Helper.buildListKeyboard(ctx, items)
      const da = {count: items.length}
      await ctx.sessionFreeText({step: bi})
      await ctx.edit(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: DeletePage, id: string, edit = false) {
    if (!id) {
      return await Alert.showWarnInvalid(ctx, edit)
    }

    const deleted = await ctx.db.deleteItem(ctx.userId, id)
    if (!deleted) {
      await Alert.showErrorNotFound(ctx, id, edit)
    } else {
      await Alert.showSuccess(ctx, id, edit)
    }
  }
}

// Deletes an item by button or ID input.
export class DeletePage extends PageBase {
  static data = this.buildData((step?: string, id?: string) => [step, id])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    const [step, id] = this.callbackDataArgs

    if (step === Base.step1) {
      await Main.processStep1Answer(this, id!, true)
    }
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }

    const {step} = this.temp.session.params
    const input = this.msgText.trim()
    if (step === Base.step1) {
      await Main.processStep1Answer(this, input, false)
    }
  }

  static template = `
    <base id="${Base.step1}">
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
