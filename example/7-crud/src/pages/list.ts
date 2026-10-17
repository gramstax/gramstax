// Lists all cached items.
import {PageBase} from "~/base/page"
import {TimeUt} from "~/utils/time"
import {StartPage} from "./start"

const PAGE_SIZE = 5

class Base {
  static index = `i`
  static infoEmpty = `i-empty`
}

export class ListPage extends PageBase {
  static data = this.buildData((pageNo?: string) => [pageNo])

  async handleCallbackQueryData() {
    await this.gindex.show(0)
  }

  async handleArgsCallbackQueryData() {
    const pageNo = this.callbackQueryDataArg
    await this.gindex.process(pageNo)
  }

  helper = {
    buildHomeKeyboard: (AGBaseId: string) => {
      return this.inlineKeyboardT([StartPage], `1`, AGBaseId)
    },
    buildKeyboard: (pageNo: number, totalPages: number) => {
      const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
      return this.inlineKeyboard(
        (k, l) => {
          if (safePage > 0) {
            k.text(l[0]!, this.data.callbackQueryData(`${safePage - 1}`))
          }
          if (safePage < totalPages - 1) {
            k.text(l[1]!, this.data.callbackQueryData(`${safePage + 1}`))
          }
          return k.row().text(l[2]!, StartPage)
        },
        {AGBaseId: Base.index}
      )
    }
  }
  gindex = {
    show: async (pageNo = 0) => {
      const totalItems = await this.db.items.total(this.from!.id)
      if (totalItems === 0) {
        return await this.ginfoEmpty.show()
      }

      const totalPages = Math.max(Math.ceil(totalItems / PAGE_SIZE), 1)
      const safePage = Math.min(Math.max(pageNo, 0), totalPages - 1)
      const offset = safePage * PAGE_SIZE
      const items = await this.db.items.list(this.from!.id, {limit: PAGE_SIZE, offset})
      const list = items
        .map((item) => {
          const ts = TimeUt.formatTimestamp(item.updatedAt!)
          return `#${item.id} ${item.title} [${item.status}] (updated ${ts})`
        })
        .join(`\n`)

      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.buildKeyboard(safePage, totalPages), data: {items: list, pageNo: safePage + 1, totalPages}})
    },
    process: async (pageNo: string) => {
      const nextPage = Number(pageNo)
      const pageNum = Number.isNaN(nextPage) ? 0 : nextPage
      await this.gindex.show(pageNum)
    }
  }
  ginfoEmpty = {
    show: async () => {
      await this.renderText({AGBaseId: Base.infoEmpty, keyboard: this.helper.buildHomeKeyboard(Base.infoEmpty)})
    },
    process: () => {}
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
