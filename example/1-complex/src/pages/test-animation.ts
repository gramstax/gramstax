import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAnimationPage extends PageBase {
  static data = this.buildData((swc?: string) => [swc])
  static BASE = {dynamicAttr: `dynamic-attribute`}

  kb(isDynamic = false) {
    return this.inlineKeyboard((k, a) => {
      return k //
        .text(isDynamic ? a[1] : a[0]!, this.data.callback(isDynamic ? `static` : `dynamic`))
        .row()
        .text(a[2]!, StartPage.data.callback(`3`)) // It doesn't have to be "3" and can be filled in with anything. This will automatically enter the callbackPayload route. Why is it filled in? Because the media method doesn't support editing via editMessageText.
    })
  }

  async callback() {
    await this.editAnimation(this.kb())
  }

  async callbackPayload() {
    const swc = this.callbackDataPayload
    if (swc == `static`) return await this.callback()
    if (swc == `dynamic`) {
      const data = {
        src: `https://www.easygifanimator.net/images/samples/eglite.gif` // Assuming is that the src value is a dynamic thing that is obtained from input or something else like a database.
      }
      await this.editAnimation(this.kb(true), data, `dynamic-attribute`)
    }
  }

  static template = `
    <base>
      <keyboard>Dynamic Attr, Static Attr, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">Dynamic Attr, Static Attr, ${this.kbl.back.id}</keyboard>
      <media type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">Caption text for media <b>animation</b></media>
      <media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">Kaption text untuk media <b>animasi</b></media>
    </base>
    
    <base id="${this.BASE.dynamicAttr}">
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
