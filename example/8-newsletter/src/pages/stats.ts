import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class StatsPage extends PageBase {
  async callback() {
    const count = await this.db.countSubscribers()
    const subscribed = await this.db.isSubscribed(this.userId)

    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb, {count, subscribed})
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        📊 Newsletter Stats

        Total subscribers: {{count}}
        Your status: {~subscribed ? "Subscribed" : "Not subscribed"~}

        This view helps you confirm whether you are on the list and how large the community is right now.
      </message>
      <message lang="id">
        📊 Statistik Newsletter

        Total pelanggan: {{count}}
        Status Anda: {~subscribed ? "Berlangganan" : "Belum berlangganan"~}

        Tampilan ini membantu Anda memastikan status langganan dan melihat total komunitas saat ini.
      </message>
    </base>
  `
}
