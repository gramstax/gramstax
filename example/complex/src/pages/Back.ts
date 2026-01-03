import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BackPage extends PageBase {
  async text() {
    await new StartPage(this).transition()
  }

  static template = /*jsx*/ `
    <base></base>
  `
}
