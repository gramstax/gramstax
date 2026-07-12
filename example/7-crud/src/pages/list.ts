import {TimeUt} from "~/utils/time"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static infoEmpty = `i-empty`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKeyboard(ctx: ListPage, AGBaseId: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }

  static buildKeyboard(ctx: ListPage, pageNo: number, totalPages: number) {
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const bi = Base.index
    const kb = ctx.inlineKeyboard(
      (k, l) => {
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(`${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(`${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackData())
      },
      {AGBaseId: bi}
    )
    return kb
  }
}

class Main {
  static async showIndex(ctx: ListPage, pageNo = 0) {
    const totalItems = await ctx.db.items.total(ctx.userId)
    if (totalItems === 0) {
      return await Main.showInfoEmpty(ctx)
    }

    const totalPages = Math.max(Math.ceil(totalItems / Helper.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
    const offset = safePage * Helper.PAGE_SIZE
    const items = await ctx.db.items.list(ctx.userId, {limit: Helper.PAGE_SIZE, offset})
    const list = items
      .map((item) => {
        const ts = TimeUt.formatTimestamp(item.updatedAt)
        return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
      })
      .join(`\n`)

    const bi = Base.index
    const da = {items: list, pageNo: safePage + 1, totalPages}
    const kb = Helper.buildKeyboard(ctx, safePage, totalPages)
    await ctx.edit(kb, da, bi)
  }

  static async processIndex(ctx: ListPage) {
    const [pageNo] = ctx.callbackDataArgs

    const nextPage = Number(pageNo)
    const pageNum = Number.isNaN(nextPage) ? 0 : nextPage
    await Main.showIndex(ctx, pageNum)
  }

  static async showInfoEmpty(ctx: ListPage) {
    const bi = Base.infoEmpty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

// Lists all cached items.
export class ListPage extends PageBase {
  static data = this.buildData((pageNo?: string) => [pageNo])

  async handleCallbackData() {
    await Main.showIndex(this, 0)
  }

  async handleArgsCallbackData() {
    await Main.processIndex(this)
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</g-keyboard>
      <g-keyboard lang="id" type="inline">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</g-keyboard>
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
