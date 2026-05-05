import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StatsPage) {
    const count = await ctx.db.countSubscribers()
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {count, subscribed}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: StatsPage) {
    throw ctx
  }
}

export class StatsPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
