import { PageBase } from "~/base"

export class TestErrorPage extends PageBase {
  public async callback() {
    // The error will be thrown to the GeneralErrorPage automatically because there is no try catch error handler in this area.
    await Promise.reject(new Error(`error from ${this.data.name}`))
  }

  public static template = /*jsx*/ `
    <base></base>
  `
}
