import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: ToggleSubscriptionPage) {
    const subscribed = await ctx.db.isSubscribed(ctx.userId)
    if (subscribed) {
      await ctx.db.unsubscribe(ctx.userId)
    } else {
      await ctx.db.subscribe(ctx.userId, {
        userName: ctx.userName,
        fullName: ctx.userFullName,
        language: ctx.userLanguage
      })
    }
    await new StartPage(ctx).showIndex(true)
  }
}

export class ToggleSubscriptionPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `<base></base>`
}
