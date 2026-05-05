import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static reset = `reset`
  static delete = `delete`
}

class Helper {
  static async built(ctx: KeyboardBottomPage, count?: number, baseId?: string) {
    const da = {}
    const kb = ctx.bottomKeyboard(
      (k, l) => {
        return k
          .text(count === undefined ? `${l[0]!} 0` : `${l[0]} ${count + 1}`)
          .row()
          .text(l[1]!)
          .oneTime()
      },
      {
        baseId: Base.step1,
        data: {
          first: ctx.data.intentText
        }
      }
    )
    await ctx.reply(kb, da, baseId)
  }
}

class Main {
  static async showStep1Form(ctx: KeyboardBottomPage, count?: number) {
    await Helper.built(ctx, count, Base.step1)
  }

  static async processStep1Answer(ctx: KeyboardBottomPage, action?: string) {
    if (action === Base.reset) {
      await Main.showActionReset(ctx, action)
    } else if (action === Base.delete) {
      await Main.showActionDelete(ctx, action)
    } else {
      await Main.showStep1Form(ctx, parseInt(ctx.msgTextArg))
    }
  }

  static async showActionDelete(ctx: KeyboardBottomPage, bi: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, Base.step1)
    const da = {}
    await ctx.reply(kb, da, bi, {
      reply_markup: {
        remove_keyboard: true
      }
    })
  }

  static async showActionReset(ctx: KeyboardBottomPage, bi: string) {
    await Helper.built(ctx, undefined, bi)
  }
}

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger for function "handleText" and "handleArgsText" because need emoticon + space, only support 1 space.
    intentCommandText: `keyboard_bottom` // <===== overrides trigger for function "handleCommandText" and "handleCommandArgsText*" because file name user "-" that not support command in telegram
  })

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleText() {
    await Main.showStep1Form(this)
  }

  async handleArgsText() {
    await Main.processStep1Answer(this)
  }

  async handleCommandText() {
    await Main.showStep1Form(this)
  }

  async handleCommandArgsText() {
    await Main.processStep1Answer(this, this.msgTextCommandArg)
  }

  static template = `    
    <base id="${Base.step1}">
      <keyboard type="inline">${this.kbl.home.default}</keyboard>
      <keyboard lang="id" type="inline">${this.kbl.home.id}</keyboard>
      <keyboard type="bottom">{{first}}, ${this.kbl.home.default}</keyboard>
      <keyboard lang="id" type="bottom">{{first}}, ${this.kbl.home.id}</keyboard>

      <message>
        ⌨️ Bottom keyboard

        Use the bottom keyboard with emojis and dynamic arg for quick actions.
      </message>
      <message lang="id">
        ⌨️ Keyboard bawah

        Gunakan keyboard bawah dengan emoji dan argument dinamis untuk aksi cepat.
      </message>
    </base>
    
    <base id="${Base.reset}">
      <message>
        ✅ Keyboard reset

        Bottom keyboard has been reset successfully.
      </message>
      <message lang="id">
        ✅ Keyboard direset

        Keyboard bawah berhasil direset.
      </message>    
    </base>

    <base id="${Base.delete}">
      <message>
        ✅ Keyboard removed

        Bottom keyboard has been removed successfully.
      </message>
      <message lang="id">
        ✅ Keyboard dihapus

        Keyboard bawah berhasil dihapus.
      </message>    
    </base>
  `
}
