import {PageBase} from "~/base/page"
import {ToggleSubscriptionPage} from "./toggle-subscription"
import {StatsPage} from "./stats"
import {HelpPage} from "./help"

export class StartPage extends PageBase {
  async show(edit = true) {
    await this.sessionClear()
    const subscribed = await this.db.isSubscribed(this.userId)
    const data = {subscribed}
    const kb = this.inlineKeyboardT([ToggleSubscriptionPage, StatsPage, HelpPage], `2`, undefined, data)
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
  }

  async callback() {
    await this.show(true)
  }

  async textCommand() {
    await this.show(false)
  }
  static template = `
    <base>
      <keyboard>{~subscribed ? "🚫 Unsubscribe" : "✅ Subscribe"~}, 📊 Stats, ❓ Help</keyboard>
      <keyboard lang="id">{~subscribed ? "🚫 Berhenti" : "✅ Langganan"~}, 📊 Statistik, ❓ Bantuan</keyboard>
      <message>
        📰 Newsletter Hub

        {~subscribed ? "Status: Subscribed" : "Status: Not subscribed"~}

        Manage your subscription with the buttons below.
      </message>
      <message lang="id">
        📰 Pusat Newsletter

        {~subscribed ? "Status: Berlangganan" : "Status: Belum berlangganan"~}

        Kelola langganan dengan tombol di bawah.
      </message>
    </base>
  `
}
