# 07 - Examples

> Complete working examples.

---

## Table of Contents

- [Start Page](#start-page)
- [Counter](#counter)
- [Language Selection](#language-selection)
- [Text Input](#text-input)
- [Photo Media](#photo-media)
- [Template Import](#template-import)
- [Map Block](#map-block)
- [Error Page](#error-page)
- [User Guard](#user-guard)

---

## Start Page

```typescript
import { PageBase } from "~/base/page";
import { CounterPage } from "./counter";

export class StartPage extends PageBase {
  public static data = this.buildData();

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, CounterPage.data.callbackData())
        .row()
        .text(arr[1]!, this.data.callbackData());
    });
  }

  public async internal(edit = true) {
    const data = { firstName: this.userFirstName };
    await this.sessionClear();
    if (edit) await this.edit(this.kb(), data);
    else await this.reply(this.kb(), data);
  }

  public async textCommand() {
    await this.internal(false);
  }
  public async callback() {
    await this.internal(true);
  }

  public static template = /*jsx*/ `
    <base id="ikb-back">
      <keyboard type="inline">Back</keyboard>
    </base>

    <base>
      <description>Start the bot</description>
      <keyboard type="inline">Counter, Refresh</keyboard>
      <message>Welcome {{firstName}}!</message>
    </base>
  `;
}
```

---

## Counter

> Uses: Callback payload, cache state

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

export class CounterPage extends PageBase {
  public static data = this.buildData((action: string = ``) => action);

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData(`I`))
        .text(arr[1]!, this.data.callbackData(`D`))
        .row()
        .text(arr[2]!, StartPage.data.callbackData());
    });
  }

  public async callback() {
    const count = (await this.cacheData.get(`${this.userId}:count`)) || `0`;
    await this.edit(this.kb(), { count });
  }

  public async callbackPayload() {
    const action = this.callbackDataPayload;
    const key = `${this.userId}:count`;
    const current = parseInt((await this.cacheData.get(key)) || `0`);

    let count =
      action === `I` ? current + 1 : action === `D` ? current - 1 : current;
    await this.cacheData.set(key, String(count));
    await this.edit(this.kb(), { count });
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Increase, Decrease, Back</keyboard>
      <message>Count: {{count}}</message>
    </base>
  `;
}
```

---

## Language Selection

> Uses: Dynamic keyboard, cache

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

export class LanguagePage extends PageBase {
  public static data = this.buildData((lang: string = ``) => lang);

  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      const currentLang = this.userLanguage?.toLowerCase();
      arr.slice(0, -1).forEach((lang, i) => {
        const code = lang.toLowerCase();
        kb.text(
          code === currentLang ? `✓ ${lang}` : lang,
          this.data.callbackData(code)
        );
        if ((i + 1) % 3 === 0) kb.row();
      });
      return kb.row().text(arr[arr.length - 1]!, StartPage.data.callbackData());
    });
  }

  public async callback() {
    await this.edit(this.kb());
  }

  public async callbackPayload() {
    const lang = this.callbackDataPayload;
    await this.cacheData.set(`${this.userId}:lang`, lang);
    this.userLanguage = lang;
    await this.edit(this.kb());
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">EN, ID, ES, Back</keyboard>
      <message>Select language:</message>
    </base>
  `;
}
```

---

## Text Input

> Uses: Session, textFree

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

export class InputTextPage extends PageBase {
  public static data = this.buildData();

  public kb(baseId?: string) {
    return this.inlineKeyboard(
      (kb, arr) => kb.text(arr[0]!, StartPage.data.callbackData()),
      { baseId }
    );
  }

  public async callback() {
    await this.sessionToTextFree();
    await this.edit(this.kb());
  }

  public async textFree() {
    const base = `result`;
    await this.sessionClear();
    await this.reply(this.kb(base), { input: this.msgText }, base);
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Cancel</keyboard>
      <message>Enter text:</message>
    </base>
    <base id="result">
      <keyboard type="inline">Back</keyboard>
      <message>You entered: {{input}}</message>
    </base>
  `;
}
```

---

## Photo Media

> Uses: Import, media block

```typescript
import { PageBase } from "~/base/page";

export class TestPhotoPage extends PageBase {
  public static data = this.buildData();

  public kb() {
    return this.inlineKeyboard((kb, arr) =>
      kb.text(arr[0]!, StartPage.data.callbackData())
    );
  }

  public async callback() {
    await this.editPhoto(this.kb());
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="ikb-back" />
      <media type="photo" src="https://example.com/image.jpg">
        Photo caption
      </media>
    </base>
  `;
}
```

---

## Template Import

```typescript
export class ImportPage extends PageBase {
  public static data = this.buildData();

  public async callback() {
    await this.edit(this.kb(), { number: Math.random() });
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="ikb-back" />
      <message>Random: {{number}}</message>
    </base>
  `;
}
```

---

## Map Block

```typescript
export class MapPage extends PageBase {
  public static data = this.buildData()

  public async callback() {
    const data = {
      items: [
        { name: `Item 1`, price: 100 },
        { name: `Item 2`, price: 200 }
      ]
    }
    await this.edit(this.kb(), data)
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Refresh, Back</keyboard>
      <message>
        <b>Items:</b>
        <map src="items" join="\\n">
          {~i+1~}. {{e.name}} - ${{e.price}}
        </map>
      </message>
    </base>
  `
}
```

---

## Error Page

```typescript
import { PageBase } from "~/base/page";
import { StartPage } from "./start";

export class GeneralErrorPage extends PageBase {
  public static data = this.buildData();

  public kb() {
    return this.inlineKeyboard((kb, arr) =>
      kb.text(arr[0]!, StartPage.data.callbackData())
    );
  }

  public async transition(source: string, error: any, isEdit: boolean) {
    console.error(`Error in ${source}:`, error);
    await this.sessionClear();
    if (isEdit) await this.edit(this.kb());
    else await this.reply(this.kb());
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Home</keyboard>
      <message><b>Error</b> - Please try again.</message>
    </base>
  `;
}
```

---

## User Guard

```typescript
import { GuardBase } from "~/base/guard";

export class UserGuard extends GuardBase {
  public async ensureValid() {
    try {
      const lang = await this.cacheData.get(`${this.userId}:lang`);
      if (lang) this.userLanguage = lang;
      return true;
    } catch (err) {
      await new GeneralErrorPage(this).transition(
        this.constructor.name,
        err,
        true
      );
      return null;
    }
  }
}
```

---

## Navigation

| Previous                                             | Next                                           |
| ---------------------------------------------------- | ---------------------------------------------- |
| [06-project-structure.md](./06-project-structure.md) | [08-best-practices.md](./08-best-practices.md) |
