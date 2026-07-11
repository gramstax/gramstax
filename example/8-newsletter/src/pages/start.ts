import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const subscribed = await ctx.db.subs.isSubscribed(ctx.userId)
    const da = {subscribed}
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`switch`), StatsPage, HelpPage], `2`, null, da)
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async processIndex(ctx: StartPage) {
    const subscribed = await ctx.db.subs.isSubscribed(ctx.userId)
    if (subscribed) {
      await ctx.db.subs.unsubscribe(ctx.userId)
    } else {
      await ctx.db.subs.subscribe(ctx.userId, {
        userName: ctx.userName,
        fullName: ctx.userFullName,
        language: ctx.userLanguage
      })
    }
    await Main.showIndex(ctx, true)
  }
}

export class StartPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleArgsCallbackData() {
    const [action] = this.callbackDataArgs
    if (action === `switch`) {
      await Main.processIndex(this)
    }
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <g-base>
      <g-keyboard>{~subscribed ? "🚫 Unsubscribe" : "✅ Subscribe"~}, 📊 Stats, ❓ Help</g-keyboard>
      <g-keyboard lang="id">{~subscribed ? "🚫 Berhenti" : "✅ Langganan"~}, 📊 Statistik, ❓ Bantuan</g-keyboard>
      <g-message>
        📰 Newsletter Hub

        Status: {~subscribed ? "Subscribed" : "Not subscribed"~}

        Stay in the loop with curated updates, release notes, and important announcements. Use the button below to manage your subscription or explore more details.
      </g-message>
      <g-message lang="id">
        📰 Pusat Newsletter

        Status: {~subscribed ? "Berlangganan" : "Belum berlangganan"~}

        Dapatkan pembaruan pilihan, catatan rilis, dan pengumuman penting. Gunakan tombol di bawah untuk mengelola langganan atau melihat informasi lainnya.
      </g-message>
    </g-base>
  `
}
