import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class TestAnimationPage extends PageBase {
  public static data = this.buildData((swc: string = ``) => swc)

  public kb(isDynamic = false) {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(isDynamic ? arr[1] : arr[0]!, this.data.callbackData(isDynamic ? `static` : `dynamic`))
        .row()
        .text(arr[2]!, StartPage.data.callbackData(`3`)) // It doesn't have to be "3" and can be filled in with anything. This will automatically enter the callbackPayload route. Why is it filled in? Because the media method doesn't support editing via editMessageText.
    })
  }

  public async callback() {
    await this.editAnimation(this.kb())
  }

  public async callbackPayload() {
    const swc = this.callbackDataPayload
    if (swc == `static`) {
      return await this.callback()
    }

    if (swc == `dynamic`) {
      const data = {
        src: `https://www.easygifanimator.net/images/samples/eglite.gif` // Assuming is that the src value is a dynamic thing that is obtained from input or something else like a database.
      }
      await this.editAnimation(this.kb(true), data, `dynamic-attribute`)
    }
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">
        Dynamic Attribute, 
        Static Attribute, 
        <import src="start" base="ikb-back" lang="default" block="keyboard" section="value" />
      </keyboard>
      <keyboard lang="id" type="inline">
        Dynamic Attribute, 
        Static Attribute, 
        <import src="start" base="ikb-back" lang="id" block="keyboard" section="value" />
      </keyboard>

      <media type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        This is a caption text for media <b>animation</b>
      </media>

      <media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        Ini adalah caption text untuk media <b>animasi</b>
      </media>
    </base>

    <base id="dynamic-attribute">
      <media type="animation" src="{{src}}">
        Supports dynamic variables and exec in attribute, except attribute lang and type. only applies to &lt;media&gt; blocks

        This is a caption text for media <b>animation</b>
      </media>

      <media lang="id" type="animation" src="{{src}}">
        Mendukung semua variables dan exec di attribute, kecuali attribute lang dan type. hanya berlaku untuk blok &lt;media&gt;

        Ini adalah caption text untuk media <b>animasi</b>
      </media>
    </base>
  `
}
