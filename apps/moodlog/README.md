# Mood Log

Prompts you through the day to tap what's been true **since the last check-in**. Once each morning it asks how you slept.

## Using it

- **Grid:** tap icons to toggle them (green = yes). Water and coffee show how many times you've logged them today.

  | | | |
  |---|---|---|
  | Water | Coffee | Food |
  | Spoke | Moved | Outside |
  | Sad | Frustrated | Happy |

- **Detail:** press and hold Sad, Frustrated or Happy to open a second grid: Pain, Tired, Fear/anxiety, Joy, Equanimity, Connection, Loneliness, Self-esteem. Tap Back to return. The corner of the mood icons turns yellow when anything on this grid is set.
- **Button:** saves. On the sleep screen it skips.
- **Sleep:** tap Good / OK / Not good.
- **Timeout:** if you don't answer in time, anything you toggled is saved. If nothing was toggled, a `missed` row is logged.
- **Log now:** open Mood Log from the launcher at any time. This logs a `manual` row and restarts the timer. If you press the button with nothing toggled, nothing is logged.

## When it prompts

Prompts are scheduled with the **Scheduler** (`sched`) library, one at a time: each prompt schedules the next when it's answered, missed or skipped. Nothing runs between prompts.

- **Check-ins:** every *Every* minutes, plus or minus *Jitter*, from the last prompt or manual log.
- **Quiet hours:** if the next check-in would fall in *Quiet from* to *Quiet until*, the sleep prompt is scheduled instead, *Sleep ask* minutes (plus or minus 5) after quiet hours end. Check-ins resume after it. To disable quiet hours and the sleep prompt, set *Quiet from* equal to *Quiet until*.
- **System Quiet Mode:** if *Sys Quiet Mode* is on and a prompt comes due while system Quiet Mode is active, it's silently pushed back. A sleep prompt retries in 30 minutes.

## CSV columns

Data goes to `moodlog2.csv`. Version 0.02 and earlier wrote `moodlog.csv`, which uses different columns. It's left in place and can still be downloaded.

| column | meaning |
|---|---|
| schema | format version (2) |
| type | checkin, manual, missed, sleep, sleep_missed, sleep_skipped |
| time | local time with UTC offset |
| unix | seconds since epoch |
| latency_s | seconds from buzz to answer (blank for manual/missed) |
| water, coffee, food, spoke, moved, outside, sad, frustrated, happy | main grid: 1/0, blank if not answered |
| pain, tired, fear_anxiety, joy, equanimity, connection, loneliness, self_esteem | detail grid: 1/0, blank if not answered |
| sleep | 2 good, 1 OK, 0 not good, sleep rows only |

The window for each answer runs from the previous *answered* row. Missed rows don't reset it.

## Install

**Easiest: your own App Loader.**
1. Fork github.com/espruino/BangleApps.
2. Put this folder at `apps/moodlog`.
3. Enable GitHub Pages on the fork.
4. Open `https://<you>.github.io/BangleApps` and install Mood Log.
5. To get your data, click the app's download icon in *My Apps*.

**Web IDE.** First install the Scheduler app from the normal App Loader. Then upload files with these names:
- `lib.js` → `moodlog`
- `app.js` → `moodlog.app.js`
- `boot.js` → `moodlog.boot.js`
- `settings.js` → `moodlog.settings.js`

Also write a file called `moodlog.info` containing:
`{"id":"moodlog","name":"Mood Log","src":"moodlog.app.js","icon":"moodlog.img"}`

The icon is optional. Reboot the watch afterwards. To get your data, download `moodlog2.csv` from the IDE's Storage menu.

If you uninstall Mood Log, also delete its entry from `sched.json` (or reinstall and uninstall the Scheduler), or the leftover alarm will throw an error once.
