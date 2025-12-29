import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class BackPage extends PageBase {
  public async text() {
    await new StartPage(this).transition()
  }

  public static template = /*jsx*/ `
    <base></base>
  `
}
