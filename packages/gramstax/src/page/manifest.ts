import type {Ctx} from "~/core/ctx"

export type ITPageManifestEntry = {path: string; routeName: string; page: typeof Ctx}
export type ITTemplateManifestEntry = {key: string; template: string}
export type ITRouteManifestEntry = {name: string; file: string; routeName: string}
export type ITAppManifest = {pages: Array<ITPageManifestEntry>; templates: Array<ITTemplateManifestEntry>; routes?: Array<ITRouteManifestEntry>}
