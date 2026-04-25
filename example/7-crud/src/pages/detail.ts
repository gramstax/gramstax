import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {TimeUt} from "~/utils/time"

class Base {
  static s1Form: `form`
  static s1Answer: `detail`
  static notFound: `not-found`
  static invalid: `invalid`
}

class Helper {
  static buildHomeKeyboard(ctx: DetailPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Flow {
  static async step1Form(ctx: DetailPage) {
    await ctx.sessionFreeText()
    const bi = Base.s1Form
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async step1Answer(ctx: DetailPage) {
    const input = ctx.msgText.trim()
    const id = input?.trim()
    if (!id) {
      return await Alert.invalid(ctx)
    }

    const item = await ctx.db.getItem(ctx.userId, id)
    if (!item) {
      return await Alert.notFound(ctx, id)
    }

    await ctx.clearSession()
    const createdAt = TimeUt.formatTimestamp(item.createdAt)
    const updatedAt = TimeUt.formatTimestamp(item.updatedAt)
    const bi = Base.s1Answer
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
}

class Alert {
  static async invalid(ctx: DetailPage) {
    const bi = Base.invalid
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async notFound(ctx: DetailPage, id: string) {
    await ctx.clearSession()
    const bi = Base.notFound
    const kb = Helper.buildHomeKeyboard(ctx, bi)
    const da = {id}
    await ctx.reply(kb, da, bi)
  }
}

// Shows a single item by ID.
export class DetailPage extends PageBase {
  async handleCallbackData() {
    await Flow.step1Form(this)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Flow.step1Answer(this)
  }

  static template = `
    <base id="${Base.s1Form}">
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

    <base id="${Base.s1Answer}">
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

    <base id="${Base.notFound}">
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

    <base id="${Base.invalid}">
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
