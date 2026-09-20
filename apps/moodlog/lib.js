// Mood Log - shared scheduling helpers (require("moodlog"))
var SF = "moodlog.state.json";

function cfg() {
  return Object.assign({interval:60, jitter:15, qStart:22, qEnd:7, sysQuiet:true, timeout:10, sleepDelay:30},
    require("Storage").readJSON("moodlog.json", 1) || {});
}
exports.cfg = cfg;

// Next time (ms) at which the clock reads hour:00, strictly after `from`
function nextHour(from, hour) {
  var d = new Date(from);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function inQuiet(c, t) {
  if (c.qStart == c.qEnd) return false; // own quiet hours disabled
  var d = new Date(t), h = d.getHours() + d.getMinutes() / 60;
  return c.qStart < c.qEnd ? (h >= c.qStart && h < c.qEnd) : (h >= c.qStart || h < c.qEnd);
}

// Set the single "moodlog" sched alarm to fire `kind` at time t
exports.scheduleAt = function(kind, t) {
  var S = require("Storage"), st = S.readJSON(SF, 1) || {};
  var ms = Math.max(60000, Math.min(t - Date.now(), 23 * 3600000));
  require("sched").setAlarm("moodlog", {
    appid: "moodlog", hidden: true, timer: ms,
    js: "require('moodlog').fire('" + kind + "')"
  });
  st.nextKind = kind;
  st.next = Date.now() + ms;
  S.writeJSON(SF, st);
};

// Next check-in: interval +/- jitter from now. If that would run into
// quiet hours, schedule the morning sleep prompt instead.
exports.scheduleNext = function() {
  var c = cfg(), now = Date.now();
  var t = now + Math.max(10, c.interval + (Math.random() * 2 - 1) * c.jitter) * 60000;
  if (c.qStart != c.qEnd) {
    var qs = inQuiet(c, now) ? now : nextHour(now, c.qStart);
    if (qs <= t) {
      var qe = nextHour(qs, c.qEnd);
      var j = (Math.random() * 2 - 1) * 5;
      exports.scheduleAt("sleep", qe + (c.sleepDelay + j) * 60000);
      return;
    }
  }
  exports.scheduleAt("checkin", t);
};

// Called by sched when the alarm goes off
exports.fire = function(kind) {
  var S = require("Storage");
  require("sched").setAlarm("moodlog", undefined); // stop it re-triggering
  var c = cfg();
  if (c.sysQuiet && ((S.readJSON("setting.json", 1) || {}).quiet | 0) > 0) {
    // System Quiet Mode is on: don't prompt, just push it back
    if (kind == "sleep") exports.scheduleAt("sleep", Date.now() + 30 * 60000);
    else exports.scheduleNext();
    require("sched").reload();
    return;
  }
  var st = S.readJSON(SF, 1) || {};
  st.pending = kind;
  st.firedAt = Date.now();
  S.writeJSON(SF, st);
  load("moodlog.app.js");
};
