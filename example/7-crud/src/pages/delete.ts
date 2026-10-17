// Deletes an item by button or ID input.
import {PageBase} from "~/base/page"
import type {IVItem} from "~/db/schema/item"
import {StartPage} from "./start"

const MAX_ITEMS = 5

class Base {
  static index = `i`
  static success = `s`
  static errorNotFound = `e-notfound`
  static warnInvalid = `w-invalid`
  static infoEmpty = `i-empty`
}

export class DeletePage extends PageBase {
  static data = this.buildData((step?: string, id?: string) => [step, id])

  async handleCallbackQueryData() {
    const getItems = await this.db.items.list(this.from!.id)
    const items = getItems.slice(0, MAX_ITEMS)
    if (items.length === 0) {
      await this.ginfoEmpty.show()
    } else {
      await this.gindex.show(items)
    }
  }

  async handleArgsCallbackQueryData() {
    const [step, id] = this.callbackQueryDataArgs
    if (step === Base.index) {
      await this.gindex.process(id!)
    }
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params ?? {}
    const input = this.msg!.text!.trim()
    if (step === Base.index) {
      await this.gindex.process(input)
    }
  }

  helper = {
    buildListKeyboard: (items: IVItem[]) => {
      return this.inlineKeyboard(
        (k, l) => {
          items.forEach((item, index) => {
            k.text(`🗑️ #${item.id} ${item.title!.slice(0, 5)}..`, this.data.callbackQueryData(Base.index, item.id!))
            if (index % 2 === 1) {
              k.row()
            }
          })
          return k.row().text(l[0]!, StartPage)
        },
        {AGBaseId: Base.index}
      )
    },
    buildHomeKeyboard: (AGBaseId: string) => {
      return this.inlineKeyboardT([StartPage], `1`, AGBaseId)
    }
  }
  gindex = {
    show: async (items: IVItem[]) => {
      await this.setSessionFreeText({step: Base.index})
      await this.renderText({AGBaseId: Base.index, keyboard: this.helper.buildListKeyboard(items), data: {count: items.length}})
    },
    process: async (id: string) => {
      if (!id) {
        await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.buildHomeKeyboard(Base.warnInvalid)})
      } else {
        const deleted = await this.db.items.remove(this.from!.id, id)
        if (!deleted) {
          await this.renderText({AGBaseId: Base.errorNotFound, keyboard: this.helper.buildHomeKeyboard(Base.errorNotFound), data: {id}})
        } else {
          await this.clearSession()
          await this.renderText({AGBaseId: Base.success, keyboard: this.helper.buildHomeKeyboard(Base.success), data: {id}})
        }
      }
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
