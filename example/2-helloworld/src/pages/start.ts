import {PageBase} from "~/base/page"

class Perform {
  static async main(ctx: PageBase, edit = true) {
    const kb = ctx.inlineKeyboardT([ctx])
    const da = {time: new Date().toString()}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Perform.main(this, false)
  }

  async handleCallbackData() {
    await Perform.main(this, true)
  }

  static template = `
    <base>
      <keyboard>Refresh</keyboard>
      <message>
        Hello World! 
        Time now: {{time}}
      </message>
    </base>
  `
}
