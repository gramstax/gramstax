import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb)
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        ❓ Help

        ✅ Subscribe: receive new broadcasts.
        🚫 Unsubscribe: stop receiving updates.
        📣 Broadcast: admins only.
        📊 Stats: check subscriber count and status.
      </message>
      <message lang="id">
        ❓ Bantuan

        ✅ Langganan: terima siaran baru.
        🚫 Berhenti: hentikan pembaruan.
        📣 Siaran: khusus admin.
        📊 Statistik: cek jumlah pelanggan dan status.
      </message>
    </base>
  `
}
