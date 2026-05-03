import {PageBase} from "~/base/page"
import {ListPage} from "./list"
import {HelpPage} from "./help"
import {CreatePage} from "./create"
import {DetailPage} from "./detail"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: StartPage, edit: boolean) {
    await ctx.clearSession()
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

// Main menu page for CRUD example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <base id="${Base.index}">
      <keyboard>➕ Create, 📋 List, 🔎 Detail, ✅ Update, 🗑️ Delete, ❓ Help</keyboard>
      <keyboard lang="id">➕ Buat, 📋 Daftar, 🔎 Detail, ✅ Perbarui, 🗑️ Hapus, ❓ Bantuan</keyboard>
      <message>
        ✅ CRUD Menu

        Manage your items quickly using the actions below. Create new entries, browse the list, view details, update status, or remove items when needed.
      </message>
      <message lang="id">
        ✅ Menu CRUD

        Kelola item dengan cepat melalui aksi di bawah. Buat item baru, lihat daftar, cek detail, perbarui status, atau hapus item saat diperlukan.
      </message>
    </base>
  `
}
