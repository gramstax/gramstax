import {PageBase} from "~/base/page"
import {TimeUt} from "~/utils/time"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static infoEmpty = `i-empty`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKeyboard(ctx: ListPage, AGBaseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }

  static buildKeyboard(ctx: ListPage, pageNo: number, totalPages: number) {
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    return ctx.inlineKeyboard(
      (k, l) => {
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackQueryData(`${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackQueryData(`${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackQueryData())
      },
      {AGBaseId: Base.index}
    )
  }
}

// Lists all cached items.
export class ListPage extends PageBase {
  static data = this.buildData((pageNo?: string) => [pageNo])

  async handleCallbackQueryData() {
    await this.gindex.show(0)
  }

  async handleArgsCallbackQueryData() {
    const pageNo = this.callbackQueryDataArg
    await this.gindex.process(pageNo)
  }

  gindex = {
    show: async (pageNo = 0) => {
      const totalItems = await this.db.items.total(this.from!.id)
      if (totalItems === 0) {
        return await this.ginfoEmpty.show()
      }

      const totalPages = Math.max(Math.ceil(totalItems / Helper.PAGE_SIZE), 1)
      const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
      const offset = safePage * Helper.PAGE_SIZE
      const items = await this.db.items.list(this.from!.id, {limit: Helper.PAGE_SIZE, offset})
      const list = items
        .map((item) => {
          const ts = TimeUt.formatTimestamp(item.updatedAt)
          return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
        })
        .join(`\n`)

      const bi = Base.index
      const da = {items: list, pageNo: safePage + 1, totalPages}
      const kb = Helper.buildKeyboard(this, safePage, totalPages)
      await this.renderEdit(kb, da, bi)
    },
    process: async (pageNo: string) => {
      const nextPage = Number(pageNo)
      const pageNum = Number.isNaN(nextPage) ? 0 : nextPage
      await this.gindex.show(pageNum)
    }
  }
  ginfoEmpty = {
    show: async () => {
      const bi = Base.infoEmpty
      const kb = Helper.buildHomeKeyboard(this, bi)
      await this.renderEdit(kb, {}, bi)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</g-keyboard>
      <g-message>
        📋 Cached items

        Page {{pageNo}}/{{totalPages}} • Browse and select an item by ID.

        {{items}}
      </g-message>
      <g-message lang="id">
        📋 Daftar item tersimpan

        Halaman {{pageNo}}/{{totalPages}} • Pilih item berdasarkan ID.

        {{items}}
      </g-message>
    </g-base>
    <g-base id="${Base.infoEmpty}">
      ${this.kbk.home()}
      <g-message>
        📭 No cached items yet.

        Start by creating your first item, then come back here to review it.
      </g-message>
      <g-message lang="id">
        📭 Belum ada item tersimpan.

        Mulailah dengan membuat item pertama, lalu kembali ke sini untuk melihatnya.
      </g-message>
    </g-base>
  `
}
