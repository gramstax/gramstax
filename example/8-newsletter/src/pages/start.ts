import {PageBase} from "~/base/page"
import {ToggleSubscriptionPage} from "./toggle-subscription"
import {StatsPage} from "./stats"
import {HelpPage} from "./help"

export class StartPage extends PageBase {
  async show(edit = true) {
    await this.clearSession()
    const subscribed = await this.db.isSubscribed(this.userId)
    const da = {subscribed}
    const kb = this.inlineKeyboardT([ToggleSubscriptionPage, StatsPage, HelpPage], `2`, undefined, da)
    if (edit) await this.edit(kb, da)
    else await this.reply(kb, da)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  async handleCommandText() {
    await this.show(false)
  }
  static template = `
    <base>
      <keyboard>{~subscribed ? "🚫 Unsubscribe" : "✅ Subscribe"~}, 📊 Stats, ❓ Help</keyboard>
      <keyboard lang="id">{~subscribed ? "🚫 Berhenti" : "✅ Langganan"~}, 📊 Statistik, ❓ Bantuan</keyboard>
      <message>
        📰 Newsletter Hub

        {~subscribed ? "Status: Subscribed" : "Status: Not subscribed"~}

        Stay in the loop with curated updates, release notes, and important announcements. Use the button below to manage your subscription or explore more details.
      </message>
      <message lang="id">
        📰 Pusat Newsletter

        {~subscribed ? "Status: Berlangganan" : "Status: Belum berlangganan"~}

        Dapatkan pembaruan pilihan, catatan rilis, dan pengumuman penting. Gunakan tombol di bawah untuk mengelola langganan atau melihat informasi lainnya.
      </message>
    </base>
  `
}
