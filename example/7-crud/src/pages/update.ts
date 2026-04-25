import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import type {MainItem} from "~/db/main"

class Base {
  static select: `select`
  static status: `status`
  static success: `success`
  static infoEmpty: `empty`
  static errorNotFound: `i-not-found`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKeyboard(ctx: UpdatePage, baseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }

  static async buildSelectKeyboard(ctx: UpdatePage, page: number, items: MainItem[]) {
    const allItems = await ctx.db.listItems(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)

    return ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(`📝 #${item.id} ${item.title.slice(0, 5)}..`, ctx.data.callbackData(`select`, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(`page`, `${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackData())
      },
      {baseId: Base.select}
    )
  }

  static buildStatusKeyboard(ctx: UpdatePage, id: string) {
    const b1 = ctx.data.callbackData(`status`, id, `todo`)
    const b2 = ctx.data.callbackData(`status`, id, `in-progress`)
    const b3 = ctx.data.callbackData(`status`, id, `done`)
    const b4 = StartPage
    return ctx.inlineKeyboardT([b1, b2, b3, b4], `3-1`, Base.status)
  }
}

class Flow {
  static async step1Form(ctx: UpdatePage, page = 0, edit = true) {
    const allItems = await ctx.db.listItems(ctx.userId)
    const totalPages = Math.max(Math.ceil(allItems.length / Helper.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const start = safePage * Helper.PAGE_SIZE
    const end = start + Helper.PAGE_SIZE
    const items = allItems.slice(start, end)

    if (items.length === 0) {
      return await Alert.infoEmpty(ctx, edit)
    }

    const bi = Base.select
    const da = {count: allItems.length, page: safePage + 1, totalPages}
    const kb = await Helper.buildSelectKeyboard(ctx, safePage, items)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async step1Answer(ctx: UpdatePage, id: string) {
    const item = await ctx.db.getItem(ctx.userId, id)
    if (!item) {
      return await Alert.infoNotFound(ctx, id)
    }
    await this.step2Form(ctx, item)
  }

  static async step2Form(ctx: UpdatePage, item: {id: string; title: string; status: string}) {
    const bi = Base.status
    const kb = Helper.buildStatusKeyboard(ctx, item.id)
    const da = {id: item.id, title: item.title, status: item.status}
    await ctx.edit(kb, da, bi)
  }

  static async step2Answer(ctx: UpdatePage, id: string, status: MainItem[`status`], edit = true) {
    const item = await ctx.db.getItem(ctx.userId, id)
    if (!item) {
      return await Flow.step1Form(ctx, 0, edit)
    }

    const updated = await ctx.db.updateItem(ctx.userId, id, item.title, item.description, status)
    if (!updated) {
      return await Flow.step1Form(ctx, 0, edit)
    }
    await Alert.success(ctx, id, status)
  }
}

class Alert {
  static async success(ctx: UpdatePage, id: string, status: MainItem[`status`]) {
    const bi = Base.success
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id, status}
    await ctx.reply(kb, da, bi)
  }

  static async infoEmpty(ctx: UpdatePage, edit = true) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async infoNotFound(ctx: UpdatePage, id: string) {
    const bi = Base.errorNotFound
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id}
    await ctx.edit(kb, da, bi)
  }
}

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((action?: string, query?: string, status?: string) => [action, query, status])

  async handleCallbackData() {
    await Flow.step1Form(this, 0, true)
  }

  async handleArgsCallbackData() {
    const [action, query, status] = this.callbackDataArgs
    if (action === `page`) {
      const page = Number(query)
      return await Flow.step1Form(this, page)
    }

    if (action === `select` && query) {
      return await Flow.step1Answer(this, query)
    }

    if (action === `status` && query && status) {
      return await Flow.step2Answer(this, query, status as MainItem[`status`], true)
    }

    await Flow.step1Form(this, 0, true)
  }

  static template = `
    <base id="${Base.select}">
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

    <base id="${Base.status}">
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

    <base id="${Base.errorNotFound}">
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
