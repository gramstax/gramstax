import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {StatsPage} from "./stats"

export class StartPage extends PageBase {
  static data = this.buildData((action?: string) => [action])

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleArgsCallbackQueryData() {
    const action = this.callbackQueryDataArg
    await this.gdefault.process(action)
  }

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      const subscribed = await this.db.subs.isSubscribed(this.from!.id)
      const da = {subscribed}
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`switch`), StatsPage, HelpPage], `2`, null, da)
      await this.renderAuto(kb, da)
    },
    process: async (action: string) => {
      if (action === `switch`) {
        const subscribed = await this.db.subs.isSubscribed(this.from!.id)
        if (subscribed) {
          await this.db.subs.unsubscribe(this.from!.id)
        } else {
          await this.db.subs.subscribe(this.from!.id, {
            userName: this.from?.username,
            fullName: this.fromFullName,
            language: this.from?.language_code
          })
        }
        await this.gdefault.show()
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
