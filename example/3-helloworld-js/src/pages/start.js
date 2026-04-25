import {PageBase} from "~/base/page"

class Perform {
  static async main(ctx = StartPage, edit = true) {
    const kb = ctx.inlineKeyboardT([ctx])
    const data = {time: new Date().toString()}
    if (edit) {
      await ctx.edit(kb, data)
    } else {
      await ctx.reply(kb, data)
    }
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Perform.main(false)
  }

  async handleCallbackData() {
    await Perform.show(true)
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
