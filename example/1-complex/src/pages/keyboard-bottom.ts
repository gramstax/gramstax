import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async main(ctx: KeyboardBottomPage, count?: number, baseId?: string) {
    const pr = {data: {first: ctx.data.intentText}}
    const kb = ctx.bottomKeyboard((k, l) => {
      return k
        .text(count === undefined ? `${l[0]!} 0` : `${l[0]} ${count + 1}`)
        .row()
        .text(l[1]!)
        .oneTime()
    }, pr)
    const da = {}
    await ctx.reply(kb, da, baseId)
  }
}

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger for function "handleText" and "handleArgsText" because need emoticon + space, only support 1 space.
    intentCommandText: `keyboard_bottom` // <===== overrides trigger for function "handleCommandText" and "handleCommandArgsText*" because file name user "-" that not support command in telegram
  })

  async handleCallbackData() {
    await Perform.main(this)
  }

  async handleText() {
    await Perform.main(this)
  }

  async handleArgsText() {
    await Perform.main(this, parseInt(this.msgTextArg))
  }

  async handleCommandText() {
    await Perform.main(this)
  }

  async handleCommandArgsText() {
    const pl = this.msgTextCommandArg
    const kb = this.inlineKeyboardT([StartPage])
    if (pl == `reset`) {
      await Perform.main(this, kb, pl)
    } else if (pl == `delete`) {
      const da = {}
      await this.reply(kb, da, pl, {
        reply_markup: {
          remove_keyboard: true
        }
      })
    }
  }

  static template = `    
    <base>
      <keyboard>${this.kbl.home.default}</keyboard>
      <keyboard lang="id">${this.kbl.home.id}</keyboard>
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
    <base id="reset">
      <message>
        ✅ Keyboard reset

        Bottom keyboard has been reset successfully.
      </message>
      <message lang="id">
        ✅ Keyboard direset

        Keyboard bawah berhasil direset.
      </message>    
    </base>
    <base id="delete">
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
