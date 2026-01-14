import {Gramstax, log} from "gramstax"

log.info(`Started..`)
new Gramstax({
  deploy: `polling`,
  token: `7552314214:AAHEf0p8MrTiU6LZg9J-YJqwEIsTYS0ZMHk`, // test token bot, its already revoke
  log: true
})
