import {PageBase} from "~/base/page"

class Main {
  static async showEntryPoint(ctx: BlankPage) {
    await ctx.callbackQueryAnswer()
  }
}

export class BlankPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `<base></base>`
}
