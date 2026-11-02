# Mood Log

Prompts you through the day to tap what's been true **since the last check-in**. Once each morning it asks how you slept.

## Using it

- **Grid:** tap icons to toggle them (green = yes). Water and coffee show how many times you've logged them today. Swipe left or right to switch between two pages. The most-used items are on the first page, which every prompt opens on.

  | Page 1 | | | Page 2 | | |
  |---|---|---|---|---|---|
  | Water | Coffee | Food | Connection | Loneliness | Self-esteem |
  | Spoke | Moved | Outside | Tired | Frustrated | Fear/anxiety |
  | Sad | Happy | Equanimity | Pain | Joy | Stressed |

- **Page dots:** the dots at the top show which page you're on. The other page's dot turns yellow when anything on it is set.
- **Button:** saves. On the sleep screen it skips. For 1.5s after a prompt pops up the button is ignored, so pressing it to wake the screen does nothing.
- **Busy:** double-press the button on a prompt to log `busy` (or `sleep_busy`) and be asked again in 45 minutes. Quiet hours still apply. Because of this, a single press on a prompt saves after a short pause.
- **Sleep:** tap Good / OK / Not good.
- **Timeout:** if you don't answer in time, anything you toggled is saved. If nothing was toggled, a `missed` row is logged. But if a timed calendar event (synced from Gadgetbridge, not all-day, under 3 hours) was on during the prompt, a `busy` row is logged instead and you're asked again 5 minutes after the event ends. Quiet hours still apply.
- **Log now:** open Mood Log from the launcher at any time. This logs a `manual` row and restarts the timer. If you press the button with nothing toggled, nothing is logged.

## When it prompts

Prompts are scheduled with the **Scheduler** (`sched`) library, one at a time: each prompt schedules the next when it's answered, missed or skipped. Nothing runs between prompts.

- **Check-ins:** every *Every* minutes, plus or minus *Jitter*, from the last prompt or manual log.
- **Quiet hours:** if the next check-in would fall in *Quiet from* to *Quiet until*, the sleep prompt is scheduled instead, *Sleep ask* minutes (plus or minus 5) after quiet hours end. Check-ins resume after it. To disable quiet hours and the sleep prompt, set *Quiet from* equal to *Quiet until*.
- **System Quiet Mode:** if *Sys Quiet Mode* is on and a prompt comes due while system Quiet Mode is active, it's silently pushed back. A sleep prompt retries in 30 minutes.

## CSV columns

Data goes to `moodlog3.csv`. Older versions wrote `moodlog2.csv` (0.03 to 0.06: the same columns without `stressed`) and `moodlog.csv` (0.02 and earlier: different columns). Both are left in place and can still be downloaded.

| column | meaning |
|---|---|
| schema | format version (3) |
| type | checkin, manual, missed, busy, sleep, sleep_missed, sleep_skipped, sleep_busy |
| time | local time with UTC offset |
| unix | seconds since epoch |
| latency_s | seconds from buzz to answer, or to saying busy (blank for manual/missed, and for busy rows logged because of a calendar event) |
| water, coffee, food, spoke, moved, outside, sad, frustrated, happy, pain, tired, fear_anxiety, joy, equanimity, connection, loneliness, self_esteem, stressed | 1/0, blank if not answered |
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

The icon is optional. Reboot the watch afterwards. To get your data, download `moodlog3.csv` from the IDE's Storage menu.

If you uninstall Mood Log, also delete its entry from `sched.json` (or reinstall and uninstall the Scheduler), or the leftover alarm will throw an error once.
