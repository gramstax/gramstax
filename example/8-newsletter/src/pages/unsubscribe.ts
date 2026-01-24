import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class UnsubscribePage extends PageBase {
  async callback() {
    const removed = await this.db.unsubscribe(this.userId)
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {name: this.userFirstName, removed})
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        {~removed ? "🚫 You have been unsubscribed." : "ℹ️ You are not subscribed yet."~}

        {~removed ? \`Thanks for being with us, \${name}. You will no longer receive future announcements unless you re-subscribe.\` : "You are not on the list yet, so there is nothing to remove."~}
      </message>
      <message lang="id">
        {~removed ? "🚫 Langganan dihentikan." : "ℹ️ Anda belum berlangganan."~}

        {~removed ? \`Terima kasih sudah bersama kami, \${name}. Anda tidak akan menerima pengumuman berikutnya kecuali berlangganan kembali.\` : "Anda belum terdaftar, jadi tidak ada yang perlu dihapus."~}
      </message>
    </base>
  `
}
