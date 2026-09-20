// Mood Log - make sure a prompt is scheduled (e.g. after first install).
// No timers or polling: the Scheduler app does the waiting.
(function() {
  try {
    if (!require("sched").getAlarm("moodlog")) {
      require("moodlog").scheduleNext();
      require("sched").reload();
    }
  } catch (e) {}
})();
