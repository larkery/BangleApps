// Mood Log - check-in screen
var S = require("Storage");
var ML = require("moodlog");

var ST_FILE = "moodlog.state.json", CSV = "moodlog.csv";
var CFG = ML.cfg();
var st = S.readJSON(ST_FILE, 1) || {};
var mode = st.pending || "manual";   // "checkin" | "sleep" | "manual"
var shownAt = (mode != "manual" && st.firedAt) ? st.firedAt : Date.now();
delete st.pending;
S.writeJSON(ST_FILE, st);

var W = g.getWidth(), H = g.getHeight();
var CS = Math.floor(W / 3), M = Math.floor((W - 3 * CS) / 2);
var TOP = 30, BH = Math.floor((H - TOP) / 3);
var CELLS = [0, 1, 2, 3, 5, 6, 7, 8]; // grid cells in CSV column order
var toggles = [false, false, false, false, false, false, false, false, false];
var stage = (mode == "sleep") ? "rate" : "grid";
var finished = false;

// ---------- icons (drawn with current colour, centred on cx,cy) ----------
function face(cx, cy) {
  g.drawCircle(cx, cy, 12); g.drawCircle(cx, cy, 11);
  g.fillRect(cx - 5, cy - 5, cx - 3, cy - 3); g.fillRect(cx + 3, cy - 5, cx + 5, cy - 3);
}
var ICONS = {
  0: ["Water", function(x, y) {
    g.fillCircle(x, y + 4, 8); g.fillPoly([x - 8, y + 3, x, y - 12, x + 8, y + 3]);
  }],
  1: ["Coffee", function(x, y) {
    g.fillRect(x - 10, y - 5, x + 4, y + 9);
    g.drawCircle(x + 7, y + 2, 4); g.drawCircle(x + 7, y + 2, 3);
    g.drawLine(x - 6, y - 12, x - 4, y - 8); g.drawLine(x, y - 12, x + 2, y - 8);
  }],
  2: ["Happy", function(x, y) {
    face(x, y); g.drawPoly([x - 6, y + 3, x - 3, y + 6, x + 3, y + 6, x + 6, y + 3]);
  }],
  3: ["Frustr.", function(x, y) {
    face(x, y);
    g.drawLine(x - 8, y - 9, x - 2, y - 6); g.drawLine(x + 8, y - 9, x + 2, y - 6);
    g.drawPoly([x - 6, y + 6, x - 3, y + 4, x, y + 6, x + 3, y + 4, x + 6, y + 6]);
  }],
  5: ["Sad", function(x, y) {
    face(x, y); g.drawPoly([x - 6, y + 7, x - 3, y + 4, x + 3, y + 4, x + 6, y + 7]);
  }],
  6: ["Talked", function(x, y) {
    g.drawRect(x - 12, y - 10, x + 12, y + 5); g.drawRect(x - 11, y - 9, x + 11, y + 4);
    g.fillPoly([x - 7, y + 5, x - 7, y + 12, x, y + 5]);
    g.fillRect(x - 6, y - 3, x - 4, y - 1); g.fillRect(x - 1, y - 3, x + 1, y - 1); g.fillRect(x + 4, y - 3, x + 6, y - 1);
  }],
  7: ["Connected", function(x, y) {
    g.drawCircle(x, y, 12); g.drawCircle(x, y, 11);
    g.drawEllipse(x - 5, y - 12, x + 5, y + 12);
    g.drawLine(x - 12, y, x + 12, y);
    g.drawLine(x - 10, y - 6, x + 10, y - 6); g.drawLine(x - 10, y + 6, x + 10, y + 6);
  }],
  8: ["Body OK", function(x, y) {
    g.fillCircle(x, y - 9, 4);
    g.fillRect(x - 1, y - 5, x + 1, y + 4);
    g.fillRect(x - 9, y - 3, x + 9, y - 1);
    g.fillPoly([x - 1, y + 3, x + 1, y + 3, x - 5, y + 13, x - 7, y + 12]);
    g.fillPoly([x - 1, y + 3, x + 1, y + 3, x + 7, y + 12, x + 5, y + 13]);
  }],
  4: ["Done", function(x, y) {
    g.fillPoly([x - 11, y, x - 7, y - 4, x - 2, y + 1, x + 8, y - 10, x + 12, y - 6, x - 2, y + 9]);
  }]
};

// ---------- drawing ----------
function drawCell(i) {
  var col = i % 3, row = Math.floor(i / 3);
  var x = M + col * CS, y = M + row * CS, cx = x + CS / 2, cy = y + CS / 2 - 6;
  var on = toggles[i], bg, fg;
  if (i == 4) { bg = "#00f"; fg = "#fff"; }
  else if (on) { bg = "#0f0"; fg = "#000"; }
  else { bg = "#000"; fg = "#fff"; }
  g.setColor(bg).fillRect(x + 2, y + 2, x + CS - 3, y + CS - 3);
  g.setColor(on || i == 4 ? bg : "#888").drawRect(x + 2, y + 2, x + CS - 3, y + CS - 3);
  g.setColor(fg);
  ICONS[i][1](cx, cy);
  g.setFont("6x8").setFontAlign(0, 0).drawString(ICONS[i][0], cx, y + CS - 9);
}
function drawGrid() {
  g.reset().setBgColor("#000").clear();
  for (var i = 0; i < 9; i++) drawCell(i);
}
function drawRate() {
  g.reset().setBgColor("#000").clear();
  g.setColor("#fff").setFont("Vector", 18).setFontAlign(0, 0)
    .drawString(mode == "sleep" ? "Sleep last night" : "Since last time", W / 2, TOP / 2);
  [["Good", "#0f0"], ["OK", "#ff0"], ["Not good", "#f00"]].forEach(function(o, b) {
    var y = TOP + b * BH;
    g.setColor(o[1]).fillRect(4, y + 3, W - 5, y + BH - 3);
    g.setColor("#000").setFont("Vector", 24).drawString(o[0], W / 2, y + BH / 2);
  });
}

// ---------- logging ----------
function pad(n) { return (n < 10 ? "0" : "") + n; }
function isoLocal(d) {
  var off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-";
  off = Math.abs(off);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" +
    pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) +
    sign + pad(Math.floor(off / 60)) + ":" + pad(off % 60);
}
function writeRow(type, flags, overall, sleep) {
  var fresh = S.open(CSV, "r").readLine() === undefined;
  var f = S.open(CSV, "a");
  if (fresh) f.write("schema,type,time,unix,latency_s,water,coffee,happy,frustrated,sad,spoke,connected,body_ok,overall,sleep\n");
  var d = new Date();
  var lat = (mode == "manual" || type.indexOf("missed") >= 0) ? "" : Math.round((d.getTime() - shownAt) / 1000);
  var cols = flags ? CELLS.map(function(i) { return flags[i] ? 1 : 0; }) : ["", "", "", "", "", "", "", ""];
  var row = [1, type, isoLocal(d), Math.floor(d.getTime() / 1000), lat].concat(cols, [overall, sleep]);
  f.write(row.join(",") + "\n");
}
function finish(type, flags, overall, sleep) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (type) writeRow(type, flags, overall, sleep);
  // Auto prompts always schedule the next one. A manual log restarts the
  // timer, unless the morning sleep prompt is what's queued.
  if (mode != "manual" || (type == "manual" && st.nextKind != "sleep")) ML.scheduleNext();
  Bangle.buzz(40);
  setTimeout(function() { load(); }, 300);
}
var gridType = (mode == "manual") ? "manual" : "checkin";

// ---------- input ----------
function onTouch(n, e) {
  if (finished) return;
  if (stage == "grid") {
    var c = Math.floor((e.x - M) / CS), r = Math.floor((e.y - M) / CS);
    if (c < 0 || c > 2 || r < 0 || r > 2) return;
    var i = r * 3 + c;
    if (i == 4) { stage = "rate"; Bangle.buzz(30); drawRate(); }
    else { toggles[i] = !toggles[i]; Bangle.buzz(15); drawCell(i); }
  } else {
    if (e.y < TOP) return;
    var rating = [2, 1, 0][Math.min(2, Math.floor((e.y - TOP) / BH))];
    if (mode == "sleep") finish("sleep", null, "", rating);
    else finish(gridType, toggles, rating, "");
  }
}
function onBtn() {
  // Button = skip. After the grid is submitted it saves without an overall rating.
  if (stage == "rate" && mode != "sleep") finish(gridType, toggles, "", "");
  else if (mode == "manual") finish(null);
  else finish(mode == "sleep" ? "sleep_skipped" : "skipped", null, "", "");
}
var timer = setTimeout(function() {
  if (stage == "rate" && mode != "sleep") finish(gridType, toggles, "", "");
  else if (mode == "manual") finish(null);
  else finish(mode == "sleep" ? "sleep_missed" : "missed", null, "", "");
}, CFG.timeout * 60000);

// ---------- start ----------
Bangle.setUI({mode: "custom", touch: onTouch, btn: onBtn});
if (stage == "grid") drawGrid(); else drawRate();
if (mode != "manual") {
  Bangle.setLCDPower(1);
  Bangle.setLocked(false);
  Bangle.buzz(250).then(function() {
    return new Promise(function(res) { setTimeout(res, 200); });
  }).then(function() { return Bangle.buzz(250); });
}
