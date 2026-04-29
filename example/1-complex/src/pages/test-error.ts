import {PageBase} from "~/base/page"

class Main {
  static async showEntryPoint(ctx: TestErrorPage) {
    await Promise.reject(new Error(`error from ${ctx.data.name}`))
  }
}

export class TestErrorPage extends PageBase {
  async handleCallbackData() {
    // The error will be thrown to the GeneralErrorPage automatically because there is no try catch error handler in this area.
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
      <message>
        🧪 Error test

        This page intentionally throws an error to demonstrate global error handling.
      </message>
    </base>
  `
}
