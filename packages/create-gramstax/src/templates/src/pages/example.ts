import { PageBase } from "~/base/page"

export class ExamplePage extends PageBase {
  public async textCommand() {
    await this.reply()
  }
}
