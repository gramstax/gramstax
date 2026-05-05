import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: HelpPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

// Help page for CRUD usage.
export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
