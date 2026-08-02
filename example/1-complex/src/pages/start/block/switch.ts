import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartBlockSwitchPage extends PageBase {
  static data = this.buildData((status?: string) => [status])

  async handleCallbackQueryData() {
    await this.bdefault.show(`0`)
  }

  async handleArgsCallbackQueryData() {
    const [status] = this.callbackQueryDataArgs
    await this.bdefault.show(status!)
  }

  bdefault = {
    show: async (status: string) => {
      const da = {status}
      const kb = this.inlineKeyboardT([this.data.callbackQueryData(status === `1` ? `0` : `1`), StartPage], `1`, null, da)
      await this.renderEdit(kb, da)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">
        <g-switch value="status">
          <g-case is="1">🔴 Off</g-case>
          <g-default>🟢 On</g-default>
        </g-switch>,
        ${this.kbl.back.default}
      </g-keyboard>
      <g-keyboard type="inline" lang="id">
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
