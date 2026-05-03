import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: StatsPage) {
    const count = await ctx.db.countSubscribers()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {count, subscribed}
    await ctx.edit(kb, da, bi)
  }
}

export class StatsPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
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
