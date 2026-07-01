import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const subscribed = await ctx.db.subs.isSubscribed(ctx.userId)
    const bi = Base.step1
    const da = {subscribed}
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(bi), StatsPage, HelpPage], `2`, bi, da)
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
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
    await Main.showStep1Form(ctx, true)
  }
}

export class StartPage extends PageBase {
  static data = this.buildData((step?: string) => [step])

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleArgsCallbackData() {
    const [step] = this.callbackDataArgs
    if (step === Base.step1) {
      await Main.processStep1Answer(this)
    }
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>{~subscribed ? "🚫 Unsubscribe" : "✅ Subscribe"~}, 📊 Stats, ❓ Help</g-keyboard>
      <g-keyboard lang="id">{~subscribed ? "🚫 Berhenti" : "✅ Langganan"~}, 📊 Statistik, ❓ Bantuan</g-keyboard>
      <g-message>
        📰 Newsletter Hub

        {~subscribed ? "Status: Subscribed" : "Status: Not subscribed"~}

        Stay in the loop with curated updates, release notes, and important announcements. Use the button below to manage your subscription or explore more details.
      </g-message>
      <g-message lang="id">
        📰 Pusat Newsletter

        {~subscribed ? "Status: Berlangganan" : "Status: Belum berlangganan"~}

        Dapatkan pembaruan pilihan, catatan rilis, dan pengumuman penting. Gunakan tombol di bawah untuk mengelola langganan atau melihat informasi lainnya.
      </g-message>
    </g-base>
  `
}
