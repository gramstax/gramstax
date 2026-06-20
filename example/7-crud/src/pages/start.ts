import {PageBase} from "~/base/page"
import {ListPage} from "./list"
import {HelpPage} from "./help"
import {CreatePage} from "./create"
import {DetailPage} from "./detail"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit: boolean) {
    await ctx.clearSession()
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

// Main menu page for CRUD example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>➕ Create, 📋 List, 🔎 Detail, ✅ Update, 🗑️ Delete, ❓ Help</g-keyboard>
      <g-keyboard lang="id">➕ Buat, 📋 Daftar, 🔎 Detail, ✅ Perbarui, 🗑️ Hapus, ❓ Bantuan</g-keyboard>
      <g-message>
        ✅ CRUD Menu

        Manage your items quickly using the actions below. Create new entries, browse the list, view details, update status, or remove items when needed.
      </g-message>
      <g-message lang="id">
        ✅ Menu CRUD

        Kelola item dengan cepat melalui aksi di bawah. Buat item baru, lihat daftar, cek detail, perbarui status, atau hapus item saat diperlukan.
      </g-message>
    </g-base>
  `
}
