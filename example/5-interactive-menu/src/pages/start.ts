import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {ResetPage} from "./reset"
import {CategoryPage} from "./category"
import {InlineWithRangePage} from "./inline-with-range"
import {InlineWithoutRangePage} from "./inline-without-range"

class Base {
  static index = `i`
  static infoQuick = `i-quick`
}

class Main {
  static async showIndex(ctx: StartPage, edit = false) {
    const bi = Base.index
    const ikb = ctx.inlineKeyboardT([CategoryPage, InlineWithRangePage, InlineWithoutRangePage, HelpPage, ResetPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(ikb, da, bi)
    } else {
      await ctx.reply(ikb, da, bi)
      await Main.showInfoQuick(ctx)
    }
  }

  static async showInfoQuick(ctx: StartPage) {
    const bi = Base.infoQuick
    const bkb = ctx.bottomKeyboardT(`2`, bi)
    const da = {}
    await ctx.reply(bkb, da, bi)
  }
}

// Main menu page for the interactive bot.
export class StartPage extends PageBase {
  static data = this.buildData({intentText: `Home`})

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">🔎 Browse, 📊 Inline Range, 🧾 Inline WRange, ❓ Help, ♻️ Reset</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 📊 Rentang Inline, 🧾 Inline Sederhana, ❓ Bantuan, ♻️ Atur Ulang</g-keyboard>
      <g-message>
        🧭 Main Menu

        Choose how you want to explore the catalog:
        - 🔎 Browse categories and drill into items
        - 📊 Inline Count for paged lists with totals
        - 🧾 Inline Simple for quick lists without totals
        - ❓ Help for navigation tips
        - ♻️ Reset to clear stored state
      </g-message>
      <g-message lang="id">
        🧭 Menu Utama

        Pilih bagaimana Anda ingin menjelajahi katalog:
        - 🔎 Jelajahi kategori dan telusuri item
        - 📊 Hitungan Inline untuk daftar halaman dengan total
        - 🧾 Inline Sederhana untuk daftar cepat tanpa total
        - ❓ Bantuan untuk tips navigasi
        - ♻️ Atur Ulang untuk menghapus status tersimpan
      </g-message>
    </g-base>
    <g-base id="${Base.infoQuick}">
      <g-keyboard type="bottom">${this.kbl.home.default}, ${this.kbl.browse.default}, ${this.kbl.help.default}, ${this.kbl.reset.default}</g-keyboard>
      <g-keyboard type="bottom" lang="id">${this.kbl.home.id}, ${this.kbl.browse.id}, ${this.kbl.help.id}, ${this.kbl.reset.id}</g-keyboard>
      <g-message>
        ✅ Quick actions enabled

        Use the bottom keyboard anytime to jump back to core actions.
      </g-message>
      <g-message lang="id">
        ✅ Aksi cepat diaktifkan

        Gunakan keyboard bawah kapan saja untuk kembali ke aksi inti.
      </g-message>
    </g-base>
  `
}
