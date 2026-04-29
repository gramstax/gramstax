import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: BlockSwitchPage, status: string) {
    const da = {status}
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(status == `1` ? `0` : `1`), StartPage], `1`, null, da)
    await ctx.edit(kb, da)
  }
}

export class BlockSwitchPage extends PageBase {
  static data = this.buildData((status?: string) => [status])

  async handleCallbackData() {
    await Main.showEntryPoint(this, `0`)
  }

  async handleArgsCallbackData() {
    await Main.showEntryPoint(this, this.callbackDataArg)
  }

  static template = `
    <base>
      <keyboard>
        <switch value="status">
          <case is="1">🔴 Off</case>
          <default>🟢 On</default>
        </switch>,
        ${this.kbl.back.default}
      </keyboard>
      <keyboard lang="id">
        <switch value="status">
          <case is="1">🔴 Mati</case>
          <default>🟢 Nyala</default>
        </switch>,
        ${this.kbl.back.id}
      </keyboard>

      <message>
        <b>🔀 Template switch demo</b>

        <switch value="status">
          <case is="1">Active</case>
          <default>Inactive</default>
        </switch>

        Toggle the button to see the template update in real time.
      </message>
      <message lang="id">
        <b>🔀 Demo switch template</b>

        <switch value="status">
          <case is="1">Aktif</case>
          <default>Tidak Aktif</default>
        </switch>

        Tekan tombol untuk melihat pembaruan template secara langsung.
      </message>
    </base>
  `
}
