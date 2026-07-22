import {PageBase} from "~/base/page"
import {ListPage} from "./list"
import {HelpPage} from "./help"
import {CreatePage} from "./create"
import {DetailPage} from "./detail"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"

// Main menu page for CRUD example.
export class StartPage extends PageBase {
  async handleCommandText() {
    await this.gdefault.show(false)
  }

  async handleCallbackQueryData() {
    await this.gdefault.show(true)
  }

  gdefault = {
    show: async (isEdit: boolean) => {
      await this.clearSession()
      const kb = this.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`)
      await this.renderAuto(kb, null, null, null, isEdit)
    }
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
