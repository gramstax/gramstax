import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"

export class StartPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackData() {
    await this.bdefault.show(true)
  }

  async handleArgsCallbackData() {
    const action = this.callbackDataArg
    await this.bdefault.process(action)
  }

  async handleCommandText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = true) => {
      await this.clearSession()
      const subscribed = await this.db.subs.isSubscribed(this.userId)
      const da = {subscribed}
      const kb = this.inlineKeyboardT([StartPage.data.callbackData(`switch`), StatsPage, HelpPage], `2`, null, da)
      if (isEdit) {
        await this.edit(kb, da)
      } else {
        await this.reply(kb, da)
      }
    },
    process: async (action: string) => {
      if (action === `switch`) {
        const subscribed = await this.db.subs.isSubscribed(this.userId)
        if (subscribed) {
          await this.db.subs.unsubscribe(this.userId)
        } else {
          await this.db.subs.subscribe(this.userId, {
            userName: this.userName,
            fullName: this.userFullName,
            language: this.userLanguage
          })
        }
        await this.bdefault.show(true)
      }
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">{~subscribed ? "🚫 Unsubscribe" : "✅ Subscribe"~}, 📊 Stats, ❓ Help</g-keyboard>
      <g-keyboard type="inline" lang="id">{~subscribed ? "🚫 Berhenti" : "✅ Langganan"~}, 📊 Statistik, ❓ Bantuan</g-keyboard>
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
