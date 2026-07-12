import {Env} from "~/env"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {CatalogPage} from "./catalog"

class Main {
  static async showIndex(ctx: HelpPage, edit = true) {
    const kb = ctx.inlineKeyboardT([CatalogPage, StartPage])
    const da = {support: Env.STORE_ADMIN_USERNAME}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🔎 Browse Products, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">🔎 Jelajahi, 🏠 Beranda</g-keyboard>
      <g-message>
        ❓ Store Help

        1. Browse products with Prev and Next.
        2. Open a product to review duration, account type, stock, and delivery time.
        3. Use ✅ Buy Now for one-item checkout or ➕ Add Cart to compare multiple products.
        4. Confirm checkout after sending your contact and notes.

        Support: {{support}}
      </g-message>
      <g-message lang="id">
        ❓ Bantuan Toko

        1. Jelajahi produk dengan Sebelumnya dan Selanjutnya.
        2. Buka produk untuk lihat durasi, tipe akun, stok, dan estimasi pengiriman.
        3. Gunakan ✅ Beli untuk checkout satu item atau ➕ Tambah untuk membandingkan produk.
        4. Konfirmasi checkout setelah mengirim kontak dan catatan.

        Dukungan: {{support}}
      </g-message>
    </g-base>
  `
}
