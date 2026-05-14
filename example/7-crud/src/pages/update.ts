import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

class Base {
  static step1 = `s1`
  static step2 = `s2`
  static success = `s`
  static infoEmpty = `i-empty`
  static infoNotFound = `i-notfound`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKeyboard(ctx: UpdatePage, baseId: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }

  static async buildStep1Keyboard(ctx: UpdatePage, page: number, items: MainItem[]) {
    const allItems = await ctx.db.listItems(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const bi = Base.step1
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(`📝 #${item.id} ${item.title.slice(0, 5)}..`, ctx.data.callbackData(bi, `select`, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(bi, `page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(bi, `page`, `${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackData())
      },
      {baseId: bi}
    )
    return kb
  }

  static buildStep2Keyboard(ctx: UpdatePage, id: string) {
    const bi = Base.step2
    const b1 = ctx.data.callbackData(bi, `todo`, id)
    const b2 = ctx.data.callbackData(bi, `in-progress`, id)
    const b3 = ctx.data.callbackData(bi, `done`, id)
    const b4 = StartPage
    const kb = ctx.inlineKeyboardT([b1, b2, b3, b4], `3-1`, bi)
    return kb
  }
}

class Alert {
  static async showSuccess(ctx: UpdatePage, id: string, status: MainItem[`status`]) {
    const bi = Base.success
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id, status}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoEmpty(ctx: UpdatePage, edit = true) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showInfoNotFound(ctx: UpdatePage, id: string) {
    const bi = Base.infoNotFound
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id}
    await ctx.edit(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: UpdatePage, page = 0, edit = true) {
    const allItems = await ctx.db.listItems(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / Helper.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * Helper.PAGE_SIZE
    const end = start + Helper.PAGE_SIZE
    const items = allItems.slice(start, end)

    if (items.length === 0) {
      return await Alert.showInfoEmpty(ctx, edit)
    }

    const bi = Base.step1
    const da = {count: allItems.length, page: safePage + 1, totalPages}
    const kb = await Helper.buildStep1Keyboard(ctx, safePage, items)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: UpdatePage, type: string, idOrPage: string) {
    if (type === `page`) {
      return await Main.showStep1Form(ctx, parseInt(idOrPage))
    } else if (type === `select`) {
      const item = await ctx.db.getItem(ctx.userId, idOrPage)
      if (item) {
        await Main.showStep2Form(ctx, item)
      } else {
        await Alert.showInfoNotFound(ctx, idOrPage)
      }
    }
  }

  static async showStep2Form(ctx: UpdatePage, item: {id: string; title: string; status: string}) {
    const bi = Base.step2
    const kb = Helper.buildStep2Keyboard(ctx, item.id)
    const da = {id: item.id, title: item.title, status: item.status}
    await ctx.edit(kb, da, bi)
  }

  static async processStep2Answer(ctx: UpdatePage, status: MainItem[`status`], id: string, edit = true) {
    const item = await ctx.db.getItem(ctx.userId, id)
    if (!item) {
      return await Main.showStep1Form(ctx, 0, edit)
    }

    const updated = await ctx.db.updateItem(ctx.userId, id, item.title, item.description, status)
    if (updated) {
      await Alert.showSuccess(ctx, id, status)
    } else {
      await Main.showStep1Form(ctx, 0, edit)
    }
  }
}

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((step?: string, arg1?: string, arg2?: string) => [step, arg1, arg2])

  async handleCallbackData() {
    await Main.showStep1Form(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [step, arg1, arg2] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this, arg1!, arg2!)
    } else if (step === Base.step2) {
      await Main.processStep2Answer(this, arg1 as MainItem[`status`], arg2!, true)
    }
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</keyboard>
      <keyboard lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</keyboard>
      <message>
        ✏️ Select an item to update its status.

        Showing {{count}} items • Page {{page}}/{{totalPages}}
      </message>
      <message lang="id">
        ✏️ Pilih item untuk memperbarui status.

        Menampilkan {{count}} item • Halaman {{page}}/{{totalPages}}
      </message>
    </base>

    <base id="${Base.step2}">
      <keyboard>📝 Todo, 🔄 In Progress, ✅ Done, 🏠 Home</keyboard>
      <keyboard lang="id">📝 Todo, 🔄 Proses, ✅ Selesai, 🏠 Beranda</keyboard>
      <message>
        📋 Item #{{id}}: {{title}}

        Current status: {{status}}

        Choose the next status for this item.
      </message>
      <message lang="id">
        📋 Item #{{id}}: {{title}}

        Status saat ini: {{status}}

        Pilih status berikutnya untuk item ini.
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Status updated

        Item #{{id}} is now: {{status}}

        You can keep updating other items from the list.
      </message>
      <message lang="id">
        ✅ Status diperbarui

        Item #{{id}} sekarang: {{status}}

        Anda dapat memperbarui item lain dari daftar.
      </message>
    </base>

    <base id="${Base.infoEmpty}">
      ${this.kbk.home()}
      <message>
        📭 No items available to update

        Create items first, then return here to update their status.
      </message>
      <message lang="id">
        📭 Tidak ada item untuk diperbarui

        Buat item terlebih dahulu, lalu kembali untuk memperbarui status.
      </message>
    </base>

    <base id="${Base.infoNotFound}">
      ${this.kbk.home()}
      <message>
        ❌ Item not found: {{id}}

        This item may have been deleted or never existed.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus atau memang tidak ada.
      </message>
    </base>
  `
}
