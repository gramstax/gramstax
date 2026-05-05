import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"
import {ToggleSubscriptionPage} from "./toggle-subscription"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    const bi = Base.step1
    const da = {subscribed}
    const kb = ctx.inlineKeyboardT([ToggleSubscriptionPage, StatsPage, HelpPage], `2`, bi, da)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

export class StartPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <base id="${Base.step1}">
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
