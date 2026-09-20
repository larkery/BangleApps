# Mood Log

Prompts you through the day to tap what's been true **since the last check-in**, then rate how things have been overall. Once each morning it asks how you slept.

## Using it

- **Grid:** tap icons to toggle them (green = yes). Tap the blue centre tick to submit.
- **Rating:** tap Good / OK / Not good.
- **Button:** skips. On the grid it logs a `skipped` row. On the rating screen it saves the grid without a rating.
- **Timeout:** if you don't answer within the set time, a `missed` row is logged.
- **Log now:** open Mood Log from the launcher at any time. This logs a `manual` row and restarts the timer.

## When it prompts

Prompts are scheduled with the **Scheduler** (`sched`) library, one at a time: each prompt schedules the next when it's answered, missed or skipped. Nothing runs between prompts.

- **Check-ins:** every *Every* minutes, plus or minus *Jitter*, from the last prompt or manual log.
- **Quiet hours:** if the next check-in would fall in *Quiet from* to *Quiet until*, the sleep prompt is scheduled instead, *Sleep ask* minutes (plus or minus 5) after quiet hours end. Check-ins resume after it. To disable quiet hours and the sleep prompt, set *Quiet from* equal to *Quiet until*.
- **System Quiet Mode:** if *Sys Quiet Mode* is on and a prompt comes due while system Quiet Mode is active, it's silently pushed back. A sleep prompt retries in 30 minutes.

## CSV columns

| column | meaning |
|---|---|
| schema | format version (1) |
| type | checkin, manual, missed, skipped, sleep, sleep_missed, sleep_skipped |
| time | local time with UTC offset |
| unix | seconds since epoch |
| latency_s | seconds from buzz to answer (blank for manual/missed) |
| water … body_ok | 1/0, blank if not answered |
| overall | 2 good, 1 OK, 0 not good, blank if skipped |
| sleep | same scale, sleep rows only |

The window for each answer runs from the previous *answered* row. Missed and skipped rows don't reset it.

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

The icon is optional. Reboot the watch afterwards. To get your data, download `moodlog.csv` from the IDE's Storage menu.

If you uninstall Mood Log, also delete its entry from `sched.json` (or reinstall and uninstall the Scheduler), or the leftover alarm will throw an error once.
