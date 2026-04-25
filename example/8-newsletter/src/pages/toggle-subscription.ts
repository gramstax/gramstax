import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async showStart(ctx: ToggleSubscriptionPage, edit = true) {
    await new StartPage(ctx).show(edit)
  }
}

class Flow {
  static async toggle(ctx: ToggleSubscriptionPage) {
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

    await Perform.showStart(ctx, true)
  }
}

export class ToggleSubscriptionPage extends PageBase {
  async handleCallbackData() {
    await Flow.toggle(this)
  }
}
