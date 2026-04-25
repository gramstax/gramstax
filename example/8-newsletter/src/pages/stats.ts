import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async show(ctx: StatsPage) {
    const count = await ctx.db.countSubscribers()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)

    const kb = ctx.inlineKeyboardT([StartPage])
    const data = {count, subscribed}
    await ctx.edit(kb, data)
  }
}

export class StatsPage extends PageBase {
  async handleCallbackData() {
    await Perform.show(this)
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
