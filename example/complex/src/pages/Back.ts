import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BackPage extends PageBase {
  async text() {
    await new StartPage(this).toError()
  }

  static template = /*html*/ `
    <base></base>
  `
}
