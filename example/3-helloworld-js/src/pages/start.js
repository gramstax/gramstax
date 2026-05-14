import {PageBase} from "../base/page.js"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx = StartPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx], `1`, bi)
    const da = {time: new Date().toString()}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx = StartPage) {
    throw ctx
  }
}

export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>Refresh</keyboard>
      <message>
        Hello World! 
        Time now: {{time}}
      </message>
    </base>
  `
}
