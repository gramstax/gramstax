import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger for function "handleText" and "handleArgsText" because need emoticon + space, only support 1 space.
    intentCommandText: `keyboard_bottom` // <===== overrides trigger for function "handleCommandText" and "handleCommandArgsText*" because file name user "-" that not support command in telegram
  })

  async show(count?: number, baseId?: string) {
    const da = {data: {first: this.data.intentText}}
    const kb = this.bottomKeyboard((k, l) => {
      return k
        .text(count === undefined ? `${l[0]!} 0` : `${l[0]} ${count + 1}`)
        .row()
        .text(l[1]!)
        .oneTime()
    }, da)
    await this.reply(kb, {}, baseId)
  }

  async handleCallbackData() {
    await this.show()
  }

  async handleText() {
    await this.show()
  }

  async handleArgsText() {
    await this.show(parseInt(this.msgTextArg))
  }

  async handleCommandText() {
    await this.show()
  }

  async handleCommandArgsText() {
    const pl = this.msgTextCommandArg
    const kb = this.inlineKeyboardT([StartPage])
    if (pl == `reset`) await this.show(kb, pl)
    if (pl == `delete`) await this.reply(kb, {}, pl, {reply_markup: {remove_keyboard: true}})
  }

  static template = (() => {
    const lh = this.kbl.home
    return `    
      <base>
        <keyboard>${lh.default}</keyboard>
        <keyboard lang="id">${lh.id}</keyboard>
        <keyboard type="bottom">{{first}}, ${lh.default}</keyboard>
        <keyboard lang="id" type="bottom">{{first}}, ${lh.id}</keyboard>

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
  })()
}
