import {PageBase} from "~/base/page"
import {CreatePage} from "./create"
import {ListPage} from "./list"
import {DetailPage} from "./detail"
import {UpdatePage} from "./update"
import {DeletePage} from "./delete"
import {HelpPage} from "./help"

// Main menu page for CRUD example.
export class StartPage extends PageBase {
  async show(edit: boolean) {
    await this.sessionClear()
    const kb = this.inlineKeyboardT([CreatePage, ListPage, DetailPage, UpdatePage, DeletePage, HelpPage], `2`, `menu`)
    if (edit) await this.edit(kb, {}, `default`)
    else await this.reply(kb, {}, `default`)
  }

  async textCommand() {
    await this.show(false)
  }

  async callback() {
    await this.show(true)
  }

  static template = `
    <base id="menu">
      <keyboard>➕ Create, 📋 List, 🔎 Detail, ✅ Update, 🗑️ Delete, ❓ Help</keyboard>
      <keyboard lang="id">➕ Buat, 📋 Daftar, 🔎 Detail, ✅ Perbarui, 🗑️ Hapus, ❓ Bantuan</keyboard>
    </base>

    <base>
      <message>
        ✅ CRUD Cache Menu

        Choose an action to manage your cached items:

        - ➕ Create
        - 📋 List
        - 🔎 Detail
        - ✅ Update
        - 🗑️ Delete
        - ❓ Help
      </message>
      <message lang="id">
        ✅ Menu CRUD Cache

        Pilih aksi untuk mengelola item tersimpan:

        - ➕ Buat
        - 📋 Daftar
        - 🔎 Detail
        - ✅ Perbarui
        - 🗑️ Hapus
        - ❓ Bantuan
      </message>
    </base>
  `
}
