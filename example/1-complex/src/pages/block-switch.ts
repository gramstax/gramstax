import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndexForm(ctx: BlockSwitchPage, status: string) {
    const da = {status}
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(status == `1` ? `0` : `1`), StartPage], `1`, null, da)
    await ctx.edit(kb, da)
  }

  static async processIndexForm(ctx: BlockSwitchPage, status: string) {
    await Main.showIndexForm(ctx, status)
  }
}

export class BlockSwitchPage extends PageBase {
  static data = this.buildData((status?: string) => [status])

  async handleCallbackData() {
    await Main.showIndexForm(this, `0`)
  }

  async handleArgsCallbackData() {
    const [status] = this.callbackDataArgs
    await Main.processIndexForm(this, status!)
  }

  static template = `
    <g-base>
      <g-keyboard>
        <g-switch value="status">
          <g-case is="1">🔴 Off</g-case>
          <g-default>🟢 On</g-default>
        </g-switch>,
        ${this.kbl.back.default}
      </g-keyboard>
      <g-keyboard lang="id">
        <g-switch value="status">
          <g-case is="1">🔴 Mati</g-case>
          <g-default>🟢 Nyala</g-default>
        </g-switch>,
        ${this.kbl.back.id}
      </g-keyboard>

      <g-message>
        <b>🔀 Template switch demo</b>

        <g-switch value="status">
          <g-case is="1">Active</g-case>
          <g-default>Inactive</g-default>
        </g-switch>

        Toggle the button to see the template update in real time.
      </g-message>
      <g-message lang="id">
        <b>🔀 Demo switch template</b>

        <g-switch value="status">
          <g-case is="1">Aktif</g-case>
          <g-default>Tidak Aktif</g-default>
        </g-switch>

        Tekan tombol untuk melihat pembaruan template secara langsung.
      </g-message>
    </g-base>
  `
}
