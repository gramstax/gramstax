import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {TimeUt} from "~/utils/time"

class Base {
  static list: `list`
  static empty: `empty`
}

class Helper {
  static PAGE_SIZE = 5

  static buildHomeKeyboard(ctx: ListPage, baseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }

  static buildKeyboard(ctx: ListPage, page: number, totalPages: number) {
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    return ctx.inlineKeyboard(
      (k, l) => {
        if (safePage > 0) {
          k.text(l[0]!, ctx.data.callbackData(`page`, `${safePage - 1}`))
        }
        if (safePage < totalPages - 1) {
          k.text(l[1]!, ctx.data.callbackData(`page`, `${safePage + 1}`))
        }
        return k.row().text(l[2]!, StartPage.data.callbackData())
      },
      {baseId: Base.list}
    )
  }
}

class Alert {
  static async infoEmpty(ctx: ListPage) {
    const bi = Base.empty
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

class Perform {
  static async entryPoint(ctx: ListPage, page = 0) {
    const totalItems = await ctx.db.countItems(ctx.userId)
    if (totalItems === 0) {
      return await Alert.infoEmpty(ctx)
    }

    const totalPages = Math.max(Math.ceil(totalItems / Helper.PAGE_SIZE), 1)
    const safePage = Math.min(Math.max(page, 0), totalPages - 1)
    const offset = safePage * Helper.PAGE_SIZE
    const items = await ctx.db.listItems(ctx.userId, {limit: Helper.PAGE_SIZE, offset})
    const list = items
      .map((item) => {
        const ts = TimeUt.formatTimestamp(item.updatedAt)
        return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
      })
      .join(`\n`)

    const bi = Base.list
    const da = {items: list, page: safePage + 1, totalPages}
    const kb = Helper.buildKeyboard(ctx, safePage, totalPages)
    await ctx.edit(kb, da, bi)
  }
}

// Lists all cached items.
export class ListPage extends PageBase {
  static data = this.buildData((action?: string, page?: string) => [action, page])

  async handleCallbackData() {
    await Perform.entryPoint(this, 0)
  }

  async handleArgsCallbackData() {
    const [action, value] = this.callbackDataArgs
    if (action !== `page`) {
      return await Perform.entryPoint(this, 0)
    }

    const nextPage = Number(value)
    const page = Number.isNaN(nextPage) ? 0 : nextPage
    await Perform.entryPoint(this, page)
  }

  static template = `
    <base id="${Base.list}">
      <keyboard>${this.kbl.prev.default}, ${this.kbl.next.default}, ${this.kbl.home.default}</keyboard>
      <keyboard lang="id">${this.kbl.prev.id}, ${this.kbl.next.id}, ${this.kbl.home.id}</keyboard>
      <message>
        📋 Cached items

        Page {{page}}/{{totalPages}} • Browse and select an item by ID.

        {{items}}
      </message>
      <message lang="id">
        📋 Daftar item tersimpan

        Halaman {{page}}/{{totalPages}} • Pilih item berdasarkan ID.

        {{items}}
      </message>
    </base>

    <base id="${Base.empty}">
      ${this.kbk.home()}
      <message>
        📭 No cached items yet.

        Start by creating your first item, then come back here to review it.
      </message>
      <message lang="id">
        📭 Belum ada item tersimpan.

        Mulailah dengan membuat item pertama, lalu kembali ke sini untuk melihatnya.
      </message>
    </base>
  `
}
