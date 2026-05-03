import {PageBase} from "~/base/page"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: PageBase, edit = true) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx], `1`, bi)
    const da = {time: new Date().toString()}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <base id="${Base.index}">
      <keyboard>Refresh</keyboard>
      <message>
        Hello World! 
        Time now: {{time}}
      </message>
    </base>
  `
}
