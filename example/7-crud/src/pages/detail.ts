import {PageBase} from "~/base/page"
import type {IVItem} from "~/db/schema/item"
import {TimeUt} from "~/utils/time"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static success = `s`
  static infoNotFound = `i-notfound`
  static warnInvalid = `w-invalid`
}

class Helper {
  static buildHomeKeyboard(ctx: DetailPage, AGBaseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
}

// Shows a single item by ID.
export class DetailPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleSessionFreeText() {
    const id = this.msg!.text!.trim()
    if (!id) {
      await this.gwarnInvalid.show()
    }

    const item = await this.db.items.fetch(this.from!.id, id)
    if (!item) {
      await this.ginfoNotFound.show(id)
    } else {
      await this.gsuccess.show(item)
    }
  }

  gindex = {
    show: async () => {
      const bi = Base.index
      const kb = Helper.buildHomeKeyboard(this, bi)
      await this.setSessionFreeText()
      await this.renderAuto(kb, {}, bi)
    }
  }
  gsuccess = {
    show: async (item: IVItem) => {
      await this.clearSession()
      const createdAt = TimeUt.formatTimestamp(item.createdAt!)
      const updatedAt = TimeUt.formatTimestamp(item.updatedAt!)

      const bi = Base.success
      const kb = Helper.buildHomeKeyboard(this, bi)
      const da = {
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        createdAt,
        updatedAt
      }
      await this.renderAuto(kb, da, bi)
    }
  }
  ginfoNotFound = {
    show: async (id: string) => {
      await this.clearSession()
      const bi = Base.infoNotFound
      const kb = Helper.buildHomeKeyboard(this, bi)
      const da = {id}
      await this.renderAuto(kb, da, bi)
    }
  }
  gwarnInvalid = {
    show: async () => {
      const bi = Base.warnInvalid
      const kb = Helper.buildHomeKeyboard(this, bi)
      await this.renderAuto(kb, {}, bi)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        🔎 View item details

        Enter the item ID to see the full record.
        Example: 1
      </g-message>
      <g-message lang="id">
        🔎 Lihat detail item

        Masukkan ID item untuk melihat data lengkap.
        Contoh: 1
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        📋 Item #{{id}}

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
        🕒 Created: {{createdAt}}
        🔄 Updated: {{updatedAt}}
      </g-message>
      <g-message lang="id">
        📋 Item #{{id}}

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}
        🕒 Dibuat: {{createdAt}}
        🔄 Diperbarui: {{updatedAt}}
      </g-message>
    </g-base>
    <g-base id="${Base.infoNotFound}">
      ${this.kbk.cancel()}
      <g-message>
        ❌ Item not found: {{id}}

        Double-check the ID and try again, or return to the list to browse.
      </g-message>
      <g-message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Periksa kembali ID, atau kembali ke daftar untuk melihat item.
      </g-message>
    </g-base>
    <g-base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <g-message>
        ⚠️ Invalid ID

        Please send a numeric item ID (example: 1).
      </g-message>
      <g-message lang="id">
        ⚠️ ID tidak valid

        Mohon kirim ID item angka (contoh: 1).
      </g-message>
    </g-base>
  `
}
