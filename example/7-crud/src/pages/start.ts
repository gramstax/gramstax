// Main menu page for CRUD example.
import {PageBase} from "~/base/page"
import {CreatePage} from "./create"
import {DeletePage} from "./delete"
import {DetailPage} from "./detail"
import {HelpPage} from "./help"
import {ListPage} from "./list"
import {UpdatePage} from "./update"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCommandText() {
    await this.gdefault.show()
  }

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      const kb = this.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`)
      await this.renderAuto(kb)
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">➕ Create, 📋 List, 🔎 Detail, ✅ Update, 🗑️ Delete, ❓ Help</g-keyboard>
      <g-keyboard type="inline" lang="id">➕ Buat, 📋 Daftar, 🔎 Detail, ✅ Perbarui, 🗑️ Hapus, ❓ Bantuan</g-keyboard>
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
