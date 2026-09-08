import {PageBase} from "~/base/page"

export class StartTestErrorPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  gdefault = {
    show: async () => {
      // The error will be thrown to the GeneralErrorPage automatically because there is no try catch error handler in this area.
      await Promise.reject(new Error(`error from ${this.data.name}`))
    }
  }

  static template = `
    <g-base>
      <g-message>
        🧪 Error test

        This page intentionally throws an error to demonstrate global error handling.
      </g-message>
      <g-message lang="id">
        🧪 Coba kesalahan 

        Halaman ini akan melempar kesalahan untuk demo global kesalahan penanganan.
      </g-message>
    </g-base>
  `
}
