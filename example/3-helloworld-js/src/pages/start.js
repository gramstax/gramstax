import {PageBase} from "~/base/page"

class Main {
  static async showEntryPoint(ctx = StartPage, edit = true) {
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
    await Main.showEntryPoint(this, false)
  }

  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
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
