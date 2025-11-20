import { PageBase } from "~/base/page"

export class ExamplePage extends PageBase {
  public async textCommand() {
    await this.reply()
  }

  public static template = /*jsx*/ `
    <base>
      <message lang="en">
        Must have file page in /pages/example.ts

        Content from /templates/example.html
      </message>
    </base>
  `
}
