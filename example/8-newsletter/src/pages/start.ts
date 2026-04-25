import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"
import {ToggleSubscriptionPage} from "./toggle-subscription"

class Perform {
  static async entryPoint(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    const da = {subscribed}
    const kb = ctx.inlineKeyboardT([ToggleSubscriptionPage, StatsPage, HelpPage], `2`, undefined, da)
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class StartPage extends PageBase {
  async transition(edit = true) {
    await Perform.entryPoint(this, edit)
  }

  async handleCallbackData() {
    await Perform.entryPoint(this, true)
  }

  async handleCommandText() {
    await Perform.entryPoint(this, false)
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
