import {log} from "./packages/gramstax/src/utils/log"

log.time(`test`, `Started new database`)
new Array(1_000_000).fill(null).map((it) => it)
log.timeEnd(`test`, `Hello world my name is damar`)
