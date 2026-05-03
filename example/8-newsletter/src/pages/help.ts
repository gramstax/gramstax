import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: HelpPage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.home()}
      <message>
        ❓ Help

        ✅ Subscribe: receive new announcements and product updates.
        🚫 Unsubscribe: stop receiving future broadcasts at any time.
        📊 Stats: check subscriber count and your current status.

        Use the buttons below to manage your subscription without typing commands.
      </message>
      <message lang="id">
        ❓ Bantuan

        ✅ Langganan: terima pengumuman dan pembaruan produk.
        🚫 Berhenti: hentikan siaran berikutnya kapan saja.
        📊 Statistik: cek jumlah pelanggan dan status Anda.

        Gunakan tombol di bawah untuk mengelola langganan tanpa mengetik perintah.
      </message>
    </base>
  `
}
