import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"

class Helper {
  static kb(ctx: GeneralStatusPage) {
    return ctx.inlineKeyboardT([ctx.data.callbackData()])
  }
}

class Main {
  static async error(ctx: GeneralStatusPage, listenerName: string, error: any, isEdit: boolean) {
    LogHe.error(listenerName, error, {isEdit})
    const msg = `${listenerName}\n\n${String(error).slice(0, 200)}`
    await ctx.reply(msg)
  }

  static async errorInputNotFound(ctx: GeneralStatusPage) {
    const kb = Helper.kb(ctx)
    const da = {text: `❌ Command not found`}
    await ctx.edit(kb, da)
  }
}

export class GeneralStatusPage extends PageBase {
  async error(listenerName: string, error: any, isEdit: boolean) {
    await Main.error(this, listenerName, error, isEdit)
  }

  async errorInputNotFound() {
    await Main.errorInputNotFound(this)
  }

  static template = `
    <base>
      <message>Status Page</message>
    </base>
  `
}
