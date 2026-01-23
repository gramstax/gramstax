import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page for CRUD usage.
export class HelpPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage], `1`, `default-kb`)
    await this.edit(kb, {}, `default`)
  }

  static template = `
    <base>
      <message>
        🧭 CRUD Help

        ➕ Create: add a title and description in two steps.
        📋 List: browse cached items with pagination.
        🔎 Detail: check item fields by ID.
        ✅ Update: pick a todo and set its status.
        🗑️ Delete: remove an item by ID.
      </message>
      <message lang="id">
        🧭 Bantuan CRUD

        ➕ Buat: tambah judul dan deskripsi dalam dua langkah.
        📋 Daftar: lihat item tersimpan dengan pagination.
        🔎 Detail: cek detail item berdasarkan ID.
        ✅ Perbarui: pilih todo dan ubah statusnya.
        🗑️ Hapus: hapus item berdasarkan ID.
      </message>
    </base>

    <base id="default-kb">
      ${this.kbk.back()}
    </base>
  `
}
