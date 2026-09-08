import {PageBase} from "~/base/page"
import {Env} from "~/env"
import {CatalogPage} from "./catalog"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleCommandText() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([CatalogPage, StartPage])
      const da = {support: Env.STORE_ADMIN_USERNAME}
      await this.renderAuto(kb, da)
    }
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
