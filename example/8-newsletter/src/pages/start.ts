import {PageBase} from "~/base/page"
import {ToggleSubscriptionPage} from "./toggle-subscription"
import {StatsPage} from "./stats"
import {HelpPage} from "./help"

class Base {}

class Helper {
  static kb(ctx: StartPage, data?: {subscribed: boolean}) {
    return ctx.inlineKeyboardT([ToggleSubscriptionPage, StatsPage, HelpPage], `2`, undefined, data)
  }
}

class Perform {
  static async show(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    const data = {subscribed}
    const kb = Helper.kb(ctx, data)

    if (edit) await ctx.edit(kb, data)
    else await ctx.reply(kb, data)
  }
}

export class StartPage extends PageBase {
  static BASE = Base

  async show(edit = true) {
    await Perform.show(this, edit)
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
