import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class StatsPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      const count = await this.db.subs.total()
      const subscribed = await this.db.subs.isSubscribed(this.from!.id)
      const kb = this.inlineKeyboardT([StartPage])
      const da = {count, subscribed}
      await this.renderAuto(kb, da)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        📊 Newsletter Stats

        Total subscribers: {{count}}
        Your status: {~subscribed ? "Subscribed" : "Not subscribed"~}

        This view helps you confirm whether you are on the list and how large the community is right now.
      </g-message>
      <g-message lang="id">
        📊 Statistik Newsletter

        Total pelanggan: {{count}}
        Status Anda: {~subscribed ? "Berlangganan" : "Belum berlangganan"~}

        Tampilan ini membantu Anda memastikan status langganan dan melihat total komunitas saat ini.
      </g-message>
    </g-base>
  `
}
