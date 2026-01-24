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

        {~removed ? \`Thanks for being with us, \${name}\` : ""~}
      </message>
      <message lang="id">
        {~removed ? "🚫 Langganan dihentikan." : "ℹ️ Anda belum berlangganan."~}

        {~removed ? \`Terima kasih sudah bersama kami, \${name}\` : ""~}
      </message>
    </base>
  `
}
