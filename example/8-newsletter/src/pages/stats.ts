import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: StatsPage) {
    const count = await ctx.db.subs.total()
    const subscribed = await ctx.db.subs.isSubscribed(ctx.userId)
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {count, subscribed}
    await ctx.edit(kb, da)
  }
}

export class StatsPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
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
