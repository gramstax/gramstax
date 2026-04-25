import {PageBase} from "~/base/page"
import {CreatePage} from "./create"
import {ListPage} from "./list"
import {DetailPage} from "./detail"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"
import {HelpPage} from "./help"

class Perform {
  static async entryPoint(ctx: StartPage, edit: boolean) {
    await ctx.clearSession()
    const kb = ctx.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`)
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

// Main menu page for CRUD example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Perform.entryPoint(this, false)
  }

  async handleCallbackData() {
    await Perform.entryPoint(this, true)
  }

  static template = `
    <base>
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
