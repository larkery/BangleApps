(function(back) {
  var FILE = "moodlog.json", changed = false;
  var s = Object.assign({interval:60, jitter:15, qStart:22, qEnd:7, sysQuiet:true, timeout:10, sleepDelay:30},
    require("Storage").readJSON(FILE, 1) || {});
  function save() { changed = true; require("Storage").writeJSON(FILE, s); }
  function hr(v) { return (v < 10 ? "0" : "") + v + ":00"; }
  function mins(v) { return v + " min"; }
  E.showMenu({
    "": {title: "Mood Log"},
    "< Back": function() {
      if (changed) { // re-plan the next prompt with the new settings
        try { require("moodlog").scheduleNext(); require("sched").reload(); } catch (e) {}
      }
      back();
    },
    "Every": {value: s.interval, min: 30, max: 240, step: 15, format: mins,
      onchange: function(v) { s.interval = v; save(); }},
    "Jitter +/-": {value: s.jitter, min: 0, max: 45, step: 5, format: mins,
      onchange: function(v) { s.jitter = v; save(); }},
    "Quiet from": {value: s.qStart, min: 0, max: 23, wrap: true, format: hr,
      onchange: function(v) { s.qStart = v; save(); }},
    "Quiet until": {value: s.qEnd, min: 0, max: 23, wrap: true, format: hr,
      onchange: function(v) { s.qEnd = v; save(); }},
    "Sleep ask": {value: s.sleepDelay, min: 10, max: 180, step: 10, format: mins,
      onchange: function(v) { s.sleepDelay = v; save(); }},
    "Sys Quiet Mode": {value: !!s.sysQuiet, onchange: function(v) { s.sysQuiet = v; save(); }},
    "Timeout": {value: s.timeout, min: 2, max: 30, step: 1, format: mins,
      onchange: function(v) { s.timeout = v; save(); }}
  });
})
