import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {IVItem} from "~/db/db"

class Base {
  static selectItem = `si`
  static selectStatus = `ss`
  static success = `s`
  static infoEmpty = `i-empty`
  static infoNotFound = `i-notfound`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKb(ctx: UpdatePage, AGBaseId: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }

  static async buildSItemKb(ctx: UpdatePage, pageNo: number, items: IVItem[]) {
    const allItems = await ctx.db.items.list(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const bi = Base.selectItem
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
      {AGBaseId: bi}
    )
    return kb
  }

  static buildSStatusKb(ctx: UpdatePage, id: string) {
    const bi = Base.selectStatus
    const b1 = ctx.data.callbackData(bi, `todo`, id)
    const b2 = ctx.data.callbackData(bi, `in-progress`, id)
    const b3 = ctx.data.callbackData(bi, `done`, id)
    const b4 = StartPage
    const kb = ctx.inlineKeyboardT([b1, b2, b3, b4], `3-1`, bi)
    return kb
  }
}

class Main {
  static async showSelectItem(ctx: UpdatePage, page = 0, edit = true) {
    const allItems = await ctx.db.items.list(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / Helper.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * Helper.PAGE_SIZE
    const end = start + Helper.PAGE_SIZE
    const items = allItems.slice(start, end)

    if (items.length === 0) {
      return await Main.showInfoEmpty(ctx, edit)
    }

    const bi = Base.selectItem
    const da = {count: allItems.length, pageNo: safePage + 1, totalPages}
    const kb = await Helper.buildSItemKb(ctx, safePage, items)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processSelectItem(ctx: UpdatePage, type: string, idOrPage: string) {
    if (type === `page`) {
      return await Main.showSelectItem(ctx, parseInt(idOrPage))
    } else if (type === `select`) {
      const item = await ctx.db.items.fetch(ctx.userId, idOrPage)
      if (item) {
        await Main.showSelectStatusForm(ctx, item)
      } else {
        await Main.showInfoNotFound(ctx, idOrPage)
      }
    }
  }

  static async showSelectStatusForm(ctx: UpdatePage, item: {id: string; title: string; status: string}) {
    const bi = Base.selectStatus
    const kb = Helper.buildSStatusKb(ctx, item.id)
    const da = {id: item.id, title: item.title, status: item.status}
    await ctx.edit(kb, da, bi)
  }

  static async processSelectStatus(ctx: UpdatePage, status: IVItem[`status`], id: string, isEdit = true) {
    const item = await ctx.db.items.fetch(ctx.userId, id)
    if (!item) {
      return await Main.showSelectItem(ctx, 0, isEdit)
    }

    const updated = await ctx.db.items.edit(ctx.userId, id, item.title, item.description, status)
    if (updated) {
      await Main.showSuccess(ctx, id, status)
    } else {
      await Main.showSelectItem(ctx, 0, isEdit)
    }
  }

  static async showSuccess(ctx: UpdatePage, id: string, status: IVItem[`status`]) {
    const bi = Base.success
    const kb = Helper.buildHomeKb(ctx, bi)
    const da = {id, status}
    await ctx.edit(kb, da, bi)
  }

  static async showInfoEmpty(ctx: UpdatePage, isEdit = true) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKb(ctx, bi)
    const da = {}
    if (isEdit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showInfoNotFound(ctx: UpdatePage, id: string) {
    const bi = Base.infoNotFound
    const kb = Helper.buildHomeKb(ctx, bi)
    const da = {id}
    await ctx.edit(kb, da, bi)
  }
}

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((step?: string, arg1?: string, arg2?: string) => [step, arg1, arg2])

  async handleCallbackData() {
    await Main.showSelectItem(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [step, arg1, arg2] = this.callbackDataArgs
    if (step === Base.selectItem) {
      await Main.processSelectItem(this, arg1!, arg2!)
    } else if (step === Base.selectStatus) {
      await Main.processSelectStatus(this, arg1 as IVItem[`status`], arg2!, true)
    }
  }

  static template = `
    <g-base id="${Base.selectItem}">
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard lang="id" type="inline">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</g-keyboard>
      <g-message>
        ✏️ Select an item to update its status.

        Showing {{count}} items • Page {{pageNo}}/{{totalPages}}
      </g-message>
      <g-message lang="id">
        ✏️ Pilih item untuk memperbarui status.

        Menampilkan {{count}} item • Halaman {{pageNo}}/{{totalPages}}
      </g-message>
    </g-base>

    <g-base id="${Base.selectStatus}">
      <g-keyboard type="inline">📝 Todo, 🔄 In Progress, ✅ Done, 🏠 Home</g-keyboard>
      <g-keyboard lang="id" type="inline">📝 Todo, 🔄 Proses, ✅ Selesai, 🏠 Beranda</g-keyboard>
      <g-message>
        📋 Item #{{id}}: {{title}}

        Current status: {{status}}

        Choose the next status for this item.
      </g-message>
      <g-message lang="id">
        📋 Item #{{id}}: {{title}}

        Status saat ini: {{status}}

        Pilih status berikutnya untuk item ini.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Status updated

        Item #{{id}} is now: {{status}}

        You can keep updating other items from the list.
      </g-message>
      <g-message lang="id">
        ✅ Status diperbarui

        Item #{{id}} sekarang: {{status}}

        Anda dapat memperbarui item lain dari daftar.
      </g-message>
    </g-base>

    <g-base id="${Base.infoEmpty}">
      ${this.kbk.home()}
      <g-message>
        📭 No items available to update

        Create items first, then return here to update their status.
      </g-message>
      <g-message lang="id">
        📭 Tidak ada item untuk diperbarui

        Buat item terlebih dahulu, lalu kembali untuk memperbarui status.
      </g-message>
    </g-base>

    <g-base id="${Base.infoNotFound}">
      ${this.kbk.home()}
      <g-message>
        ❌ Item not found: {{id}}

        This item may have been deleted or never existed.
      </g-message>
      <g-message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Item ini mungkin sudah dihapus atau memang tidak ada.
      </g-message>
    </g-base>
  `
}
