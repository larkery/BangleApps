// Mood Log - check-in screen
var S = require("Storage");
var ML = require("moodlog");

var ST_FILE = "moodlog.state.json", CSV = "moodlog3.csv";
var CFG = ML.cfg();
var st = S.readJSON(ST_FILE, 1) || {};
var mode = st.pending || "manual";   // "checkin" | "sleep" | "manual"
var shownAt = (mode != "manual" && st.firedAt) ? st.firedAt : Date.now();
delete st.pending;
S.writeJSON(ST_FILE, st);

var W = g.getWidth(), H = g.getHeight();
var CS = Math.floor(W / 3), M = Math.floor((W - 3 * CS) / 2);
var TOP = 30, BH = Math.floor((H - TOP) / 3);
// Swipe left/right between pages. Page 1 has the most-used items.
var PAGES = [
  ["water", "coffee", "food", "spoke", "moved", "outside", "sad", "happy", "equanimity"],
  ["connection", "loneliness", "self_esteem", "tired", "frustrated", "fear", "pain", "joy", "stressed"]
];
var COLS = ["water", "coffee", "food", "spoke", "moved", "outside", "sad", "frustrated", "happy",
  "pain", "tired", "fear", "joy", "equanimity", "connection", "loneliness", "self_esteem", "stressed"]; // CSV column order
var toggles = {};
var stage = (mode == "sleep") ? "rate" : "grid"; // "grid" | "rate"
var page = 0;
var finished = false;

// ---------- today's counts ----------
function pad(n) { return (n < 10 ? "0" : "") + n; }
function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayCounts(s) {
  var k = dayKey(new Date());
  return (s.counts && s.counts.d == k) ? s.counts : {d: k, water: 0, coffee: 0};
}
var counts = todayCounts(st);
var COUNTED = {water: 1, coffee: 1};

// ---------- icons (drawn with current colour, centred on cx,cy) ----------
function face(cx, cy) {
  g.drawCircle(cx, cy, 12); g.drawCircle(cx, cy, 11);
  g.fillRect(cx - 5, cy - 5, cx - 3, cy - 3); g.fillRect(cx + 3, cy - 5, cx + 5, cy - 3);
}
function thick(x1, y1, x2, y2) {
  g.drawLine(x1, y1, x2, y2); g.drawLine(x1 + 1, y1, x2 + 1, y2); g.drawLine(x1, y1 + 1, x2, y2 + 1);
}
var ICONS = {
  water: ["Water", function(x, y) {
    g.fillCircle(x, y + 4, 8); g.fillPoly([x - 8, y + 3, x, y - 12, x + 8, y + 3]);
  }],
  coffee: ["Coffee", function(x, y) {
    g.fillRect(x - 10, y - 5, x + 4, y + 9);
    g.drawCircle(x + 7, y + 2, 4); g.drawCircle(x + 7, y + 2, 3);
    g.drawLine(x - 6, y - 12, x - 4, y - 8); g.drawLine(x, y - 12, x + 2, y - 8);
  }],
  food: ["Food", function(x, y) { // apple
    g.fillCircle(x - 4, y + 3, 8); g.fillCircle(x + 4, y + 3, 8);
    g.fillRect(x - 1, y - 11, x + 1, y - 4);
    g.fillPoly([x + 1, y - 7, x + 8, y - 12, x + 6, y - 6]);
  }],
  spoke: ["Spoke", function(x, y) {
    g.drawRect(x - 12, y - 10, x + 12, y + 5); g.drawRect(x - 11, y - 9, x + 11, y + 4);
    g.fillPoly([x - 7, y + 5, x - 7, y + 12, x, y + 5]);
    g.fillRect(x - 6, y - 3, x - 4, y - 1); g.fillRect(x - 1, y - 3, x + 1, y - 1); g.fillRect(x + 4, y - 3, x + 6, y - 1);
  }],
  moved: ["Moved", function(x, y) { // runner
    g.fillCircle(x + 4, y - 10, 3);
    thick(x + 2, y - 5, x - 2, y + 3);
    thick(x + 1, y - 3, x + 8, y);
    thick(x + 1, y - 3, x - 6, y - 4);
    thick(x - 2, y + 3, x + 5, y + 7); thick(x + 5, y + 7, x + 5, y + 13);
    thick(x - 2, y + 3, x - 7, y + 9); thick(x - 7, y + 9, x - 12, y + 9);
  }],
  outside: ["Outside", function(x, y) { // tree on the ground
    g.fillCircle(x, y - 6, 7); g.fillCircle(x - 6, y, 6); g.fillCircle(x + 6, y, 6);
    g.fillRect(x - 1, y + 2, x + 1, y + 12);
    g.fillRect(x - 12, y + 12, x + 12, y + 13);
  }],
  happy: ["Happy", function(x, y) {
    face(x, y); g.drawPoly([x - 6, y + 3, x - 3, y + 6, x + 3, y + 6, x + 6, y + 3]);
  }],
  frustrated: ["Frustr.", function(x, y) {
    face(x, y);
    g.drawLine(x - 8, y - 9, x - 2, y - 6); g.drawLine(x + 8, y - 9, x + 2, y - 6);
    g.drawPoly([x - 6, y + 6, x - 3, y + 4, x, y + 6, x + 3, y + 4, x + 6, y + 6]);
  }],
  sad: ["Sad", function(x, y) {
    face(x, y); g.drawPoly([x - 6, y + 7, x - 3, y + 4, x + 3, y + 4, x + 6, y + 7]);
  }],
  pain: ["Pain", function(x, y) { // lightning bolt
    g.fillPoly([x + 3, y - 13, x - 7, y + 2, x - 1, y + 2, x - 4, y + 13, x + 7, y - 3, x + 1, y - 3]);
  }],
  tired: ["Tired", function(x, y) {
    g.setFont("Vector", 22).setFontAlign(0, 0).drawString("Zz", x, y + 1);
  }],
  fear: ["Fear/anx", function(x, y) { // wide eyes, wobbly mouth
    g.drawCircle(x, y, 12); g.drawCircle(x, y, 11);
    g.drawCircle(x - 5, y - 4, 2); g.drawCircle(x + 5, y - 4, 2);
    g.drawPoly([x - 6, y + 6, x - 4, y + 4, x - 2, y + 6, x, y + 4, x + 2, y + 6, x + 4, y + 4, x + 6, y + 6]);
  }],
  joy: ["Joy", function(x, y) { // sun
    g.fillCircle(x, y, 6);
    for (var a = 0; a < 8; a++) {
      var s = Math.sin(a * Math.PI / 4), c = Math.cos(a * Math.PI / 4);
      thick(x + 9 * c, y + 9 * s, x + 13 * c, y + 13 * s);
    }
  }],
  equanimity: ["Equanim.", function(x, y) { // balanced scales
    g.fillRect(x - 1, y - 10, x + 1, y + 10); g.fillRect(x - 7, y + 9, x + 7, y + 11);
    g.fillRect(x - 12, y - 9, x + 12, y - 8);
    g.drawLine(x - 10, y - 8, x - 14, y + 2); g.drawLine(x - 10, y - 8, x - 6, y + 2); g.fillRect(x - 14, y + 2, x - 6, y + 3);
    g.drawLine(x + 10, y - 8, x + 14, y + 2); g.drawLine(x + 10, y - 8, x + 6, y + 2); g.fillRect(x + 6, y + 2, x + 14, y + 3);
  }],
  connection: ["Connect.", function(x, y) { // linked rings
    g.drawCircle(x - 5, y, 8); g.drawCircle(x - 5, y, 7);
    g.drawCircle(x + 5, y, 8); g.drawCircle(x + 5, y, 7);
  }],
  loneliness: ["Lonely", function(x, y) { // lone figure
    g.fillCircle(x, y - 6, 5);
    g.fillPoly([x - 8, y + 12, x - 8, y + 6, x - 5, y + 2, x + 5, y + 2, x + 8, y + 6, x + 8, y + 12]);
  }],
  self_esteem: ["Self-est.", function(x, y) { // star
    var p = [];
    for (var a = 0; a < 10; a++) {
      var r = (a & 1) ? 5 : 13, t = a * Math.PI / 5 - Math.PI / 2;
      p.push(x + r * Math.cos(t), y + 1 + r * Math.sin(t));
    }
    g.fillPoly(p);
  }],
  stressed: ["Stressed", function(x, y) { // flat mouth, sweat drop
    face(x, y); g.fillRect(x - 5, y + 5, x + 5, y + 6);
    g.fillCircle(x + 15, y - 2, 3); g.fillPoly([x + 12, y - 2, x + 15, y - 9, x + 18, y - 2]);
  }]
};

// ---------- drawing ----------
function cells() { return PAGES[page]; }
function anyOn(p) {
  for (var i = 0; i < 9; i++) if (toggles[PAGES[p][i]]) return true;
  return false;
}
function anyToggled() {
  for (var i = 0; i < COLS.length; i++) if (toggles[COLS[i]]) return true;
  return false;
}
function drawCell(i) {
  var name = cells()[i];
  var col = i % 3, row = Math.floor(i / 3);
  var x = M + col * CS, y = M + row * CS, cx = x + CS / 2, cy = y + CS / 2 - 6;
  var on = toggles[name], bg = on ? "#0f0" : "#000", fg = on ? "#000" : "#fff";
  g.setColor(bg).fillRect(x + 2, y + 2, x + CS - 3, y + CS - 3);
  g.setColor(on ? bg : "#888").drawRect(x + 2, y + 2, x + CS - 3, y + CS - 3);
  if (i == 1) { // page dots: current one filled, the other yellow if anything on it is set
    for (var p = 0; p < PAGES.length; p++) {
      var dx = cx + (p * 2 - PAGES.length + 1) * 5;
      if (p == page) g.setColor(fg).fillCircle(dx, y + 7, 2);
      else g.setColor(anyOn(p) ? "#ff0" : "#888").drawCircle(dx, y + 7, 2);
    }
  }
  g.setColor(fg);
  ICONS[name][1](cx, cy);
  g.setFont("6x8").setFontAlign(0, 0).drawString(ICONS[name][0], cx, y + CS - 9);
  if (COUNTED[name]) {
    g.setFont("6x8", 2).setFontAlign(1, -1).drawString(counts[name] + (on ? 1 : 0), x + CS - 5, y + 5);
  }
}
function drawGrid() {
  g.reset().setBgColor("#000").clear();
  for (var i = 0; i < 9; i++) drawCell(i);
}
function drawRate() {
  g.reset().setBgColor("#000").clear();
  g.setColor("#fff").setFont("Vector", 18).setFontAlign(0, 0)
    .drawString("Sleep last night", W / 2, TOP / 2);
  [["Good", "#0f0"], ["OK", "#ff0"], ["Not good", "#f00"]].forEach(function(o, b) {
    var y = TOP + b * BH;
    g.setColor(o[1]).fillRect(4, y + 3, W - 5, y + BH - 3);
    g.setColor("#000").setFont("Vector", 24).drawString(o[0], W / 2, y + BH / 2);
  });
}

// ---------- logging ----------
function isoLocal(d) {
  var off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-";
  off = Math.abs(off);
  return dayKey(d) + "T" +
    pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + pad(Math.floor(off / 60)) + ":" + pad(off % 60);
}
function writeRow(type, flags, sleep, auto) {
  var fresh = S.open(CSV, "r").readLine() === undefined;
  var f = S.open(CSV, "a");
  if (fresh) f.write("schema,type,time,unix,latency_s," + COLS.join(",").replace("fear", "fear_anxiety") + ",sleep\n");
  var d = new Date();
  var lat = (auto || mode == "manual" || type.indexOf("missed") >= 0) ? "" : Math.round((d.getTime() - shownAt) / 1000);
  var cols = COLS.map(function(k) { return flags ? (flags[k] ? 1 : 0) : ""; });
  var row = [3, type, isoLocal(d), Math.floor(d.getTime() / 1000), lat].concat(cols, [sleep]);
  f.write(row.join(",") + "\n");
  if (flags) { // keep today's water/coffee totals in the state file
    var s = S.readJSON(ST_FILE, 1) || {}, c = todayCounts(s);
    for (var k in COUNTED) if (flags[k]) c[k]++;
    s.counts = c;
    S.writeJSON(ST_FILE, s);
  }
}
var BUSY_MINS = 45;
// `until` (ms) is set when a calendar event made us busy: ask again then.
function finish(type, flags, sleep, until) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (type) writeRow(type, flags, sleep, until);
  // Busy asks again soon: the sleep prompt as itself, a check-in via
  // scheduleNext so quiet hours still apply.
  if (type == "sleep_busy") ML.scheduleAt("sleep", Date.now() + BUSY_MINS * 60000);
  else if (type == "busy") ML.scheduleNext(until ? Math.max(1, (until - Date.now()) / 60000) : BUSY_MINS);
  // Auto prompts always schedule the next one. A manual log restarts the
  // timer, unless the morning sleep prompt is what's queued.
  else if (mode != "manual" || (type == "manual" && st.nextKind != "sleep")) ML.scheduleNext();
  Bangle.buzz(40);
  setTimeout(function() { load(); }, 300);
}
var gridType = (mode == "manual") ? "manual" : "checkin";
function save() {
  if (mode == "manual" && !anyToggled()) finish(null); // nothing to log
  else finish(gridType, toggles, "");
}

// ---------- input ----------
function cellAt(x, y) {
  var c = Math.floor((x - M) / CS), r = Math.floor((y - M) / CS);
  return (c < 0 || c > 2 || r < 0 || r > 2) ? -1 : r * 3 + c;
}
function tap(i) {
  var name = cells()[i];
  toggles[name] = !toggles[name]; Bangle.buzz(15); drawCell(i);
}
// Taps come from drag events, so a swipe (which moves) never also toggles.
var press = null;
function onDrag(e) {
  if (finished || stage == "rate") return;
  if (e.b) {
    if (!press) press = {x: e.x, y: e.y, i: cellAt(e.x, e.y)};
    else if (Math.abs(e.x - press.x) + Math.abs(e.y - press.y) > 20) press.moved = true;
  } else if (press) {
    if (!press.moved && press.i >= 0) tap(press.i);
    press = null;
  }
}
function onSwipe(lr) {
  if (finished || stage == "rate" || !lr) return;
  // The swipe arrives before the finger lifts, and a fast one may not have
  // moved far enough between drag events to count, so cancel the press here.
  if (press) press.moved = true;
  page = (page - lr + PAGES.length) % PAGES.length;
  Bangle.buzz(30); drawGrid();
}
function onTouch(n, e) {
  if (finished || stage != "rate" || e.y < TOP) return;
  finish("sleep", null, [2, 1, 0][Math.min(2, Math.floor((e.y - TOP) / BH))]);
}
// When a prompt pops up by itself, a button press in the first moment is
// probably meant to wake the screen, not to save an empty check-in.
var BTN_GUARD_MS = 1500, btnReadyAt = (mode == "manual") ? 0 : Date.now() + BTN_GUARD_MS;
// On a prompt, one press saves (or skips the sleep screen) and a double press
// means "busy, ask again in a bit". So a single press waits DOUBLE_MS to see
// if a second one follows. Manual logs have no busy, so act at once.
var DOUBLE_MS = 400, btnTimer;
function onBtn() {
  if (finished || Date.now() < btnReadyAt) return;
  if (btnTimer) {
    clearTimeout(btnTimer); btnTimer = undefined;
    Bangle.buzz(40).then(function() { return new Promise(function(res) { setTimeout(res, 100); }); })
      .then(function() { finish(stage == "rate" ? "sleep_busy" : "busy", null, ""); });
    return;
  }
  if (mode == "manual") { save(); return; }
  btnTimer = setTimeout(function() {
    btnTimer = undefined;
    // Button saves the grid. On the sleep screen it skips.
    if (stage == "rate") finish("sleep_skipped", null, "");
    else save();
  }, DOUBLE_MS);
}
// A timed calendar event (not all-day, under EVENT_MAX_H long) overlapping
// the prompt explains a missed check-in. Returns the latest such event's end
// (ms), or 0 if there's none.
var EVENT_MAX_H = 3, EVENT_AFTER_MINS = 5;
function busyUntil() {
  var cal = S.readJSON("android.calendar.json", 1) || [], end = 0, now = Date.now();
  cal.forEach(function(e) {
    var d = e.durationInSeconds || 0, s = e.timestamp * 1000, en = s + d * 1000;
    if (e.allDay || !d || d >= EVENT_MAX_H * 3600) return;
    if (s <= now && en > shownAt && en > end) end = en;
  });
  return end;
}
var timer = setTimeout(function() {
  if (stage == "rate") finish("sleep_missed", null, "");
  else if (anyToggled() || mode == "manual") save();
  else {
    var end = busyUntil();
    if (end) finish("busy", null, "", end + EVENT_AFTER_MINS * 60000);
    else finish("missed", null, "");
  }
}, CFG.timeout * 60000);

// ---------- start ----------
Bangle.setUI({mode: "custom", touch: onTouch, drag: onDrag, swipe: onSwipe, btn: onBtn});
if (stage == "grid") drawGrid(); else drawRate();
if (mode != "manual") {
  Bangle.setLCDPower(1);
  Bangle.setLocked(false);
  Bangle.buzz(250).then(function() {
    return new Promise(function(res) { setTimeout(res, 200); });
  }).then(function() { return Bangle.buzz(250); });
}
