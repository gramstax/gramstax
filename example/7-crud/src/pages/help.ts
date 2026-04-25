import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: HelpPage) {
    const kb = ctx.inlineKeyboardT([StartPage])
    await ctx.edit(kb)
  }
}

// Help page for CRUD usage.
export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        🧭 CRUD Help

        ➕ Create: add a title and description in two steps.
        📋 List: browse saved items with pagination controls.
        🔎 Detail: view full item data by ID.
        ✅ Update: change an item status from todo → in progress → done.
        🗑️ Delete: remove an item by ID with confirmation prompts.
      </message>
      <message lang="id">
        🧭 Bantuan CRUD

        ➕ Buat: tambah judul dan deskripsi dalam dua langkah.
        📋 Daftar: lihat item tersimpan dengan kontrol halaman.
        🔎 Detail: tampilkan data lengkap berdasarkan ID.
        ✅ Perbarui: ubah status item dari todo → proses → selesai.
        🗑️ Hapus: hapus item berdasarkan ID dengan konfirmasi.
      </message>
    </base>
  `
}
