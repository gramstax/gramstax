import {PageBase} from "~/base/page"
import type {IVItem} from "~/db/db"
import {StartPage} from "./start"

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
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }

  static async buildSItemKb(ctx: UpdatePage, pageNo: number, items: IVItem[]) {
    const allItems = await ctx.db.items.list(ctx.from!.id!)
    const totalPages = Math.max(Math.ceil(allItems.length / this.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const bi = Base.selectItem
    return ctx.inlineKeyboard(
      (k, l) => {
        items.forEach((item, index) => {
          k.text(`📝 #${item.id} ${item.title.slice(0, 5)}..`, ctx.data.callbackQueryData(bi, `select`, item.id))
          if (index % 2 === 1) {
            k.row()
          }
        })

        k.row()
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackQueryData(bi, `page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackQueryData(bi, `page`, `${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackQueryData())
      },
      {AGBaseId: bi}
    )
  }

  static buildSStatusKb(ctx: UpdatePage, id: string) {
    const bi = Base.selectStatus
    const b1 = ctx.data.callbackQueryData(bi, `todo`, id)
    const b2 = ctx.data.callbackQueryData(bi, `in-progress`, id)
    const b3 = ctx.data.callbackQueryData(bi, `done`, id)
    const b4 = StartPage
    return ctx.inlineKeyboardT([b1, b2, b3, b4], `3-1`, bi)
  }
}

// Updates item status via inline selection.
export class UpdatePage extends PageBase {
  static data = this.buildData((step?: string, arg1?: string, arg2?: string) => [step, arg1, arg2])

  async handleCallbackQueryData() {
    await this.gselectItem.show(0, true)
  }

  async handleArgsCallbackQueryData() {
    const [step, arg1, arg2] = this.callbackQueryDataArgs
    if (step === Base.selectItem) {
      await this.gselectItem.process(arg1!, arg2!)
    } else if (step === Base.selectStatus) {
      await this.gselectStatus.process(arg1 as IVItem[`status`], arg2!)
    }
  }

  gselectItem = {
    show: async (pageNo = 0, isEdit = true) => {
      const allItems = await this.db.items.list(this.from!.id)
      const totalPages = Math.max(Math.ceil(allItems.length / Helper.PAGE_SIZE), 1)
      const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
      const start = safePage * Helper.PAGE_SIZE
      const end = start + Helper.PAGE_SIZE
      const items = allItems.slice(start, end)
      if (items.length === 0) {
        return await this.ginfoEmpty.show(isEdit)
      }

      const bi = Base.selectItem
      const da = {count: allItems.length, pageNo: safePage + 1, totalPages}
      const kb = await Helper.buildSItemKb(this, safePage, items)
      await this.renderAuto(kb, da, bi, null, isEdit)
    },
    process: async (type: string, idOrPage: string) => {
      if (type === `page`) {
        await this.gselectItem.show(parseInt(idOrPage))
      } else if (type === `select`) {
        const item = await this.db.items.fetch(this.from!.id, idOrPage)
        if (item) {
          await this.gselectStatus.show(item)
        } else {
          await this.ginfoNotFound.show(idOrPage)
        }
      }
    }
  }
  gselectStatus = {
    show: async (item: IVItem) => {
      const bi = Base.selectStatus
      const kb = Helper.buildSStatusKb(this, item.id)
      const da = {id: item.id, title: item.title, status: item.status}
      await this.renderEdit(kb, da, bi)
    },
    process: async (status: IVItem[`status`], id: string) => {
      const item = await this.db.items.fetch(this.from!.id, id)
      if (!item) {
        return await this.gselectItem.show(0, true)
      }

      const updated = await this.db.items.edit(this.from!.id, id, item.title, item.description, status)
      if (updated) {
        await this.gsuccess.show(id, status)
      } else {
        await this.gselectItem.show(0, true)
      }
    }
  }
  ginfoNotFound = {
    show: async (id: string) => {
      const bi = Base.infoNotFound
      const kb = Helper.buildHomeKb(this, bi)
      const da = {id}
      await this.renderEdit(kb, da, bi)
    }
  }
  ginfoEmpty = {
    show: async (isEdit = true) => {
      const bi = Base.infoEmpty
      const kb = Helper.buildHomeKb(this, bi)
      await this.renderAuto(kb, {}, bi, null, isEdit)
    }
  }
  gsuccess = {
    show: async (id: string, status: string) => {
      const bi = Base.success
      const kb = Helper.buildHomeKb(this, bi)
      const da = {id, status}
      await this.renderEdit(kb, da, bi)
    }
  }

  static template = `
    <g-base id="${Base.selectItem}">
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</g-keyboard>
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
      <g-keyboard type="inline" lang="id">📝 Todo, 🔄 Proses, ✅ Selesai, 🏠 Beranda</g-keyboard>
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
