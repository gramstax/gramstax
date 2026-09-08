import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page for CRUD usage.
export class HelpPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAuto(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        🧭 CRUD Help

        ➕ Create: add a title and description in two steps.
        📋 List: browse saved items with pagination controls.
        🔎 Detail: view full item data by ID.
        ✅ Update: change an item status from todo → in progress → done.
        🗑️ Delete: remove an item by ID with confirmation prompts.
      </g-message>
      <g-message lang="id">
        🧭 Bantuan CRUD

        ➕ Buat: tambah judul dan deskripsi dalam dua langkah.
        📋 Daftar: lihat item tersimpan dengan kontrol halaman.
        🔎 Detail: tampilkan data lengkap berdasarkan ID.
        ✅ Perbarui: ubah status item dari todo → proses → selesai.
        🗑️ Hapus: hapus item berdasarkan ID dengan konfirmasi.
      </g-message>
    </g-base>
  `
}
