import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class StatsPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const count = await this.db.subs.total()
      const subscribed = await this.db.subs.isSubscribed(this.from!.id)
      await this.renderText({keyboard: this.inlineKeyboardT([StartPage]), data: {count, subscribed}})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        📊 Newsletter Stats

        Total subscribers: {{count}}
        Your status: <g-ifelse>subscribed ? "Subscribed" : "Not subscribed"</g-ifelse>

        This view helps you confirm whether you are on the list and how large the community is right now.
      </g-message>
      <g-message lang="id">
        📊 Statistik Newsletter

        Total pelanggan: {{count}}
        Status Anda: <g-ifelse>subscribed ? "Berlangganan" : "Belum berlangganan"</g-ifelse>

        Tampilan ini membantu Anda memastikan status langganan dan melihat total komunitas saat ini.
      </g-message>
    </g-base>
  `
}
