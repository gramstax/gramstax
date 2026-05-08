import {TimeUt} from "~/utils/time"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static success = `s`
  static infoNotFound = `i-notfound`
  static warnInvalid = `w-invalid`
}

class Helper {
  static buildHomeKeyboard(ctx: DetailPage, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }
}

class Alert {
  static async showSuccess(ctx: DetailPage, item: Awaited<ReturnType<DetailPage[`db`][`getItem`]>>) {
    if (!item) {
      return
    }
    await ctx.clearSession()
    const createdAt = TimeUt.formatTimestamp(item.createdAt)
    const updatedAt = TimeUt.formatTimestamp(item.updatedAt)

    const bi = Base.success
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      createdAt,
      updatedAt
    }
    await ctx.reply(kb, da, bi)
  }

  static async showWarnInvalid(ctx: DetailPage) {
    const bi = Base.warnInvalid
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async showInfoNotFound(ctx: DetailPage, id: string) {
    await ctx.clearSession()
    const bi = Base.infoNotFound
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id}
    await ctx.reply(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: DetailPage) {
    await ctx.sessionFreeText()
    const bi = Base.step1
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: DetailPage) {
    const id = ctx.msgText.trim()
    if (!id) {
      return await Alert.showWarnInvalid(ctx)
    }

    const item = await ctx.db.getItem(ctx.userId, id)
    if (!item) {
      await Alert.showInfoNotFound(ctx, id)
    } else {
      await Alert.showSuccess(ctx, item)
    }
  }
}

// Shows a single item by ID.
export class DetailPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.cancel()}
      <message>
        🔎 View item details

        Enter the item ID to see the full record.
        Example: 1
      </message>
      <message lang="id">
        🔎 Lihat detail item

        Masukkan ID item untuk melihat data lengkap.
        Contoh: 1
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        📋 Item #{{id}}

        🏷️ Title: {{title}}
        📝 Description: {{description}}
        📌 Status: {{status}}
        🕒 Created: {{createdAt}}
        🔄 Updated: {{updatedAt}}
      </message>
      <message lang="id">
        📋 Item #{{id}}

        🏷️ Judul: {{title}}
        📝 Deskripsi: {{description}}
        📌 Status: {{status}}
        🕒 Dibuat: {{createdAt}}
        🔄 Diperbarui: {{updatedAt}}
      </message>
    </base>

    <base id="${Base.infoNotFound}">
      ${this.kbk.cancel()}
      <message>
        ❌ Item not found: {{id}}

        Double-check the ID and try again, or return to the list to browse.
      </message>
      <message lang="id">
        ❌ Item tidak ditemukan: {{id}}

        Periksa kembali ID, atau kembali ke daftar untuk melihat item.
      </message>
    </base>

    <base id="${Base.warnInvalid}">
      ${this.kbk.cancel()}
      <message>
        ⚠️ Invalid ID

        Please send a numeric item ID (example: 1).
      </message>
      <message lang="id">
        ⚠️ ID tidak valid

        Mohon kirim ID item angka (contoh: 1).
      </message>
    </base>
  `
}
