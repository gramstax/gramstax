import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class KeyboardBottomPage extends PageBase {
  static data = this.buildData({
    intentText: `📚 KBBottom:`, // <===== overrides trigger route function "text" because need emoticon + space, only support 1 space.
    intentTextCommand: `keyboard_bottom` // <===== overrides trigger route function "textCommand" because file name user "-" that not support command in telegram
  })

  async show(count?: number, baseId?: string) {
    const da = {data: {first: this.data.intentText}}
    const kb = this.bottomKeyboard((k, a) => {
      return k
        .text(count === undefined ? `${a[0]!} 0` : `${a[0]} ${count + 1}`)
        .row()
        .text(a[1]!)
        .oneTime()
    }, da)
    await this.reply(kb, {}, baseId)
  }

  async callback() {
    await this.show()
  }

  async text() {
    await this.show()
  }

  async textPayload() {
    await this.show(parseInt(this.msgTextPayload))
  }

  async textCommand() {
    await this.show()
  }

  async textCommandPayload() {
    const pl = this.msgTextCommandPayload
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

          Use the bottom keyboard with emojis and dynamic payloads for quick actions.
        </message>
        <message lang="id">
          ⌨️ Keyboard bawah

          Gunakan keyboard bawah dengan emoji dan payload dinamis untuk aksi cepat.
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
