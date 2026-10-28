# The Elements puck: Bluetooth protocol (v1, 2026-10-28)

The puck is the source of truth. It advertises over Bluetooth Low Energy as **`The Elements <ID>`** (this first puck: `The Elements 0`). Any client (the web app via Web Bluetooth in Chrome, the iPhone app via CoreBluetooth) connects, reads the state, subscribes to state changes, and sends button commands. Every client draws the same 200×200 screen from the state, so the puck, the web page and the phone always show the same thing.

## GATT
| What | UUID | Properties |
|---|---|---|
| Service | `e1e70001-5a1d-4c6e-9d1e-0e1e3e7e0001` | |
| State | `e1e70002-5a1d-4c6e-9d1e-0e1e3e7e0001` | read, notify |
| Command | `e1e70003-5a1d-4c6e-9d1e-0e1e3e7e0001` | write, write without response |

## State (UTF-8 JSON, one object, sent on connect and after every change)
```json
{"v":1,"screen":"select","sel":0,"face":0,"faceId":"neutral","faceName":"Neutral","faceCount":138,"qrTitle":"","qrUrl":"","sd":"SD 29.5 GB, 29.5 free","bat":87,"mv":4010,"id":"0"}
```
- `screen`: `select` | `qr` | `faces` | `off`
- `sel`: 0 = Apple iOS, 1 = Android (highlighted option on `select`)
- `face`: index into the face list (0-based); `faceId`: file name in `art/faces/svg/<faceId>.svg`
- `qrTitle`, `qrUrl`: shown on `qr` (clients draw the QR code from `qrUrl`)
- `sd`: storage line shown on `select`
- `id`: the permanent Element ID (see below)
- `bat`: battery 0-100 % (-1 = not measured yet), `mv`: battery voltage in millivolts; sent every 30 s when it changes

## Commands (UTF-8 text written to Command)
| Command | Same as on the puck | Effect |
|---|---|---|
| `next` | BOOT click | select: toggle iOS/Android · faces: next face |
| `prev` | BOOT double-click | faces: previous face |
| `confirm` | PWR click | select → qr · qr → select · faces → select |
| `faces` | BOOT long press | open the face gallery |
| `back` | — | go to select |
| `select:0` / `select:1` | — | highlight iOS / Android directly |
| `face:<n>` | — | show face n directly (opens the gallery) |
| `off` | PWR long press | "Sleeping", then power off on battery |
| `setid:<ID>` | — | set the permanent Element ID (saved in flash), then restart |

## Screen layout (200×200, black on white), for clients that draw it
- **select**: top row small (Montserrat 10, top 6): "ELEMENT <id>" left (x 6), battery "`bat`%" right (x −6), no icon · two option boxes 168×46 at top 50 and 102, each the logo (28 px, Simple Icons apple/android) + name in Montserrat 20 ("Apple iOS", "Android"); the selected one is white on a black box (radius 10) · SD line (Montserrat 10, bottom −20) · "BOOT: move   PWR: choose" (Montserrat 10, bottom −6).
- **qr**: `qrTitle` (top 6) · QR code 140×140 centred (+4) · "PWR: back" (bottom −4).
- **faces**: face image 168×168 (top 2) · "`n/count  faceName`" (bottom −6).
- **off**: "Sleeping" (Montserrat 28, centred).
- Touch/click regions for clients: select → tap an option (y 48–99 = iOS, 99–150 = Android) = `select:n` then `confirm`; qr → tap = `confirm`; faces → left half = `prev`, right half = `next`, bottom strip = `back`.

## Element IDs
Every puck has a permanent ID, kept in its flash (NVS `elements`/`id`) and in its Bluetooth name.
- The first one is **Element Zero**: ID `0` (this puck, 2026-10-28).
- Then `A00`, `A01` … `A99`, `B00` … `Z99` (2,600 IDs), then `A000` … `Z999` (26,000), then `A0000` … and so on without end.
- The n-th ID: `ElementID.id(forIndex:)` in the iPhone app (`Sources/Core/PuckLink.swift`): 1 → A00, 100 → A99, 101 → B00, 2600 → Z99, 2601 → A000.
- Give a new puck its ID once over Bluetooth: write `setid:A00` to the Command characteristic.

## First connection on an iPhone (AirPods-style)
1. Scan the QR code on the puck (Apple iOS). It contains `theelements://pair?id=<ID>`. Today it opens the installed app; once the app is in the App Store it will become a web link that opens the App Store when the app is missing.
2. The app finds that Element and connects without asking (no trip to iOS Bluetooth settings: Bluetooth Low Energy devices connect inside their app).
3. Without the QR code: open the app near the puck; a card slides up ("Element Zero · The Elements · ID 0 · Connect").
4. After the first connection the iPhone remembers the Element and reconnects by itself whenever the app is open. "…" → Forget removes it.

## Living Element, talk and voice (firmware 0.5, 2026-10-28)
- After the first phone connects (`menu`), the puck's home is the **living Element** (`screen: "element"`): one face whose expression changes every 6 s from the pool of its `mood` (`idle`, `listening`, `thinking`, `speaking`, `done`, `error`, `lowbat`). **PWR = talk** (toggles `rec`; the phone records), **BOOT = menu** (`Element`, `Pair a phone`, `Info`).
- Commands: `mood:<m>`, `rec:0|1`, `text-` / `text+<chunk>` / `text!` (show Claude's answer for 10 s, `screen: "text"`), `lvl:<0-9>` (phone microphone level), `vol:<0-100>`, `beep` (test tone), `aud-<bytes>` + binary chunks + `aud!` (spoken answer), `reset` (forget pairing).
- Characteristics: **Text** `e1e70004-…` (read, notify: the answer on screen), **Audio** `e1e70005-…` (write without response: 16 kHz mono 16-bit little-endian PCM). Every spoken answer is saved on the SD card as `/sdcard/voice/<n>.pcm` and played on the speaker (ES8311, amplifier on EXIO3).
- State adds `mood`, `rec`, `vol`, `play` (1 while the speaker plays) and `lvl`. **Waves**: on the Element screen, 11 bars 3 px wide, 7 px apart, centred at the bottom (y 197 up), height `lvl - |i-5|/2`, shown while `rec` or `play`, updated ~3 times a second from the real output level (or the phone's microphone).
- The iPhone app (Element 0) makes the voice with the open-source **Kokoro-82M** model (mlx-audio-swift, voice `af_heart`), downloaded once in Settings → Voice.

## Fast voice, logs, mood faces, Wi-Fi (firmware 0.8 - 1.0, 2026-10-28, from the Optimus Prime plan)
- **Streaming voice**: `aud2-` opens a stream; IMA-ADPCM 4-bit bytes (16 kHz, 8 KB/s, low nibble first) go to the Audio characteristic into a 24 KB RAM ring; playback starts after ~0.3 s; `aud2!` ends it. Nothing is written to SD during speech. The phone streams Claude's answer (SSE), speaks each sentence as soon as it is complete and appends it to the same stream.
- **Mood tag**: Claude starts each answer with `[mood:<word>]`; the phone sends `emote:<word>` and the Element shows a face of that mood.
- **1,000+ faces**: `/sdcard/faces/<mood>/<n>.bin` (168x168 LVGL I1: 8-byte palette + 21 bytes/row), `/sdcard/faces/index.txt` = `<mood> <count>` lines; made by `art/faces/gen1000.mjs` (19 moods, 1,036 faces, 4 MB). Built-in faces are the fallback. `file-<path>` + bytes on the Audio characteristic + `file!` writes any file to the SD card (`art/faces/send_faces.mjs` copies the faces through the Mac bridge).
- **Logs**: `log-` / `log+<chunk>` / `log!` appends a line to `/sdcard/log/YYYY-MM-DD.txt` (written when the speaker is quiet); `time:<local epoch>` sets the clock on connect. The phone keeps `Documents/Element0/logs/YYYY-MM-DD.jsonl`.
- **Volume cap**: `volmax:<10-100>` (kept in NVS) caps the voice and tones.
- **Wi-Fi**: `wifi+<ssid>\t<password>` saves a network (up to 10, NVS namespace `wifi`), `wifi-<ssid>` forgets it, `wifi:on|off`. The puck joins the strongest saved network it can see. State: `wifi` (`off`, `searching`, `<ssid> -54dBm`, `no saved network nearby`), `wifis` (count). Passwords are stored in the puck's flash (NVS, not encrypted).
- **Display / memory**: LVGL renders in 8-bit grey (L8, `LV_COLOR_DEPTH 8` in `~/Documents/Arduino/libraries/lv_conf.h`), no `EPD_Clear` before each flush; free heap ~120 KB with Wi-Fi off.

## Firmware 1.1 (2026-10-28): pet sounds and USB commands
- **Pet sounds** (made on the puck, no phone needed): `pet:<minutes>` sound interval (0 = off, minimum 15, default 120, kept in NVS; each wait is 70-130 % of it), `petq:<from>,<to>` quiet hours in local time (default `22,8`; `0,0` = never quiet), `chirp:<1-8>` play one now (`chirp:0` = random). Sounds: 1 pip-pip, 2 mrrp, 3 hm?, 4 yawn, 5 giggle, 6 coo, 7 boop-beep, 8 sigh. Never while the Element talks, listens or plays a voice. State: `pet` (minutes), `petq` (`"22-8"`).
- **USB serial**: every text command above can also be typed on the USB serial port (115200 baud, one per line), for tests without Bluetooth.

## Firmware 1.2 - 1.3 (2026-10-28): Wi-Fi updates, charging, low battery
- **Wi-Fi update**: `update:check` reads `https://dcreations.fr/element0/firmware/latest.json` (`version`, `url`, `size`, `sha256`); `update:go` also downloads the app image into the spare app slot (`ota_0`/`ota_1`), checks its SHA-256, and restarts on it. HTTPS only, checked against ISRG Root X1/X2 and GTS Root R1/R4. A failed or cut download changes nothing. The puck also checks (never installs) once a day when on Wi-Fi. State `upd`: `""`, `checking`, `1.3 available`, `up to date`, `installing 40%`, `installed, restarting`, `failed: ...`. The update task only exists while it runs (TLS needs the RAM).
- **Publishing**: `Publish Element 0 Firmware.command` (raise `FIRMWARE_VERSION` first) builds, writes `firmware/element0-<ver>-<sha8>.bin` + `latest.json` and the page's full-flash zip, commits those files in the website repo and pushes.
- **Charging**: `chg` in the state (1 = USB link to a computer, or battery voltage rising or >= 4.17 V on a charger). Battery shows a bolt; idle face becomes cozy/content; "charging" bottom left of the Element screen; a pip-pip when plugged in.
- **Low battery** (<= 20 %, not charging): tired faces, "charge me" bottom left, one sigh when it drops to 20 %.
- **Full on a wall charger** (no computer link, >= 4.18 V and flat for 3 min): "full, unplug me" and a coo. The firmware cannot switch off USB power (the charger chip is not wired to the ESP32); the charger chip itself stops at full.
