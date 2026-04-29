import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {ApiService} from "~/core/services/api"

class Base {
  static s1 = `s1`
  static success = `success`
  static infoNotFound = `info-not-found`
  static error = `error`
}

class Helper {
  static kb(ctx: SearchPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Main {
  static async showStep1Form(ctx: SearchPage) {
    await ctx.sessionFreeText()
    const bi = Base.s1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: SearchPage) {
    const query = ctx.msgText.trim()
    if (!query || query.length < 2) {
      return await Main.showStep1Form(ctx)
    }

    try {
      const data = await ApiService.searchProducts(query, 0, 10)
      const count = data.products.length
      await ctx.clearSession()

      if (data.products.length === 0) {
        await Alert.infoNotFound(ctx, query, count)
      } else {
        await Alert.success(ctx, query, count)
      }
    } catch {
      await Alert.error(ctx)
    }
  }
}

class Alert {
  static async success(ctx: SearchPage, query: string, count: number) {
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const da = {query, count}
    await ctx.reply(kb, da, bi)
  }

  static async error(ctx: SearchPage) {
    const bi = Base.error
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async infoNotFound(ctx: SearchPage, query: string, count: number) {
    const bi = Base.infoNotFound
    const kb = Helper.kb(ctx, bi)
    const da = {query, count}
    await ctx.reply(kb, da, bi)
  }
}

export class SearchPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

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
    <base id="${Base.s1}">
      ${this.kbk.cancel()}
      <message>
        🔍 Search Products

        Enter a search keyword (minimum 2 characters).
      </message>
      <message lang="id">
        🔍 Cari Produk

        Masukkan kata kunci pencarian (minimum 2 karakter).
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.back()}
      <message>
        🔍 Search Results for "{{query}}"

        Found {{count}} results.

        Search powered by DummyJSON API.
      </message>
      <message lang="id">
        🔍 Hasil Pencarian untuk "{{query}}"

        Ditemukan {{count}} hasil.

        Pencarian menggunakan API DummyJSON.
      </message>
    </base>

    <base id="${Base.infoNotFound}">
      ${this.kbk.back()}
      <message>
        🔍 No results for "{{query}}"

        Try a different search term.
      </message>
      <message lang="id">
        🔍 Tidak ada hasil untuk "{{query}}"

        Coba kata kunci pencarian lain.
      </message>
    </base>

    <base id="${Base.error}">
      ${this.kbk.back()}
      <message>
        🔍 Search failed

        Please try again later.
      </message>
      <message lang="id">
        🔍 Pencarian gagal

        Silakan coba lagi nanti.
      </message>
    </base>
  `
}
