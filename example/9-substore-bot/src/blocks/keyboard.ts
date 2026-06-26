import {BlockKeyboard, LabelKeyboard} from "gramstax"

export class KeyboardBlock extends BlockKeyboard {
  static label = class extends LabelKeyboard {
    static home = {default: `🏠 Home`, id: `🏠 Beranda`}
    static browse = {default: `🔎 Browse`, id: `🔎 Jelajahi`}
    static cart = {default: `🛒 Cart`, id: `🛒 Keranjang`}
    static history = {default: `🧾 History`, id: `🧾 Riwayat`}
    static help = {default: `❓ Help`, id: `❓ Bantuan`}
    static back = {default: `⬅️ Back`, id: `⬅️ Kembali`}
    static prev = {default: `⬅️ Prev`, id: `⬅️ Sebelumnya`}
    static next = {default: `➡️ Next`, id: `➡️ Selanjutnya`}
    static buy = {default: `✅ Buy Now`, id: `✅ Beli`}
    static addCart = {default: `➕ Add Cart`, id: `➕ Tambah`}
    static checkout = {default: `💳 Checkout`, id: `💳 Bayar`}
    static clear = {default: `🧹 Clear`, id: `🧹 Kosongkan`}
    static confirm = {default: `✅ Confirm`, id: `✅ Konfirmasi`}
    static cancel = {default: `❌ Cancel`, id: `❌ Batal`}
    static remove = {default: `🗑️ Remove`, id: `🗑️ Hapus`}
    static plus = {default: `➕`, id: `➕`}
    static minus = {default: `➖`, id: `➖`}
    static continueShopping = {default: `${this.browse.default}`, id: `${this.browse.id}`}
    static cancelHome = {default: `${this.cancel.default} | ${this.home.default}`, id: `${this.cancel.id} | ${this.home.id}`}
  }

  static home = (lang?: string, type?: string) => this._build(`home`, lang, type)
  static browse = (lang?: string, type?: string) => this._build(`browse`, lang, type)
  static cart = (lang?: string, type?: string) => this._build(`cart`, lang, type)
  static history = (lang?: string, type?: string) => this._build(`history`, lang, type)
  static help = (lang?: string, type?: string) => this._build(`help`, lang, type)
  static back = (lang?: string, type?: string) => this._build(`back`, lang, type)
  static cancel = (lang?: string, type?: string) => this._build(`cancel`, lang, type)
}
