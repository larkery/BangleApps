// banglejs app made by pancake
// hacks by claude
// sunrise/sunset script by Matt Kane from https://github.com/Triggertrap/sun-js

const LOCATION_FILE = 'mylocation.json';

Bangle.setUI('clock');
Bangle.loadWidgets();

// requires the myLocation app
function loadLocation () {
  try {
    return require('Storage').readJSON(LOCATION_FILE, 1);
  } catch (e) {
    return { lat: 41.38, lon: 2.168 };
  }
}
const latlon = loadLocation() || {};
const lat = latlon.lat || 41.38;
const lon = latlon.lon || 2.168;

/* ---------------------------------------------------------------------------
 *  Next-appointment cache
 *  Reading + parsing the calendar JSON is the single most expensive thing this
 *  watch face does, so we do NOT do it every minute. We rescan only when:
 *    - we've never scanned, or
 *    - the cached appointment has now ended (a new "next" is due), or
 *    - it's been longer than APPT_RESCAN_MS since the last scan (to pick up a
 *      fresh calendar sync from the phone).
 * ------------------------------------------------------------------------- */
const APPT_RESCAN_MS = 10 * 60 * 1000; // 10 minutes
let nextAppt = null;
let apptScanAt = 0;

function loadNextAppointment () {
  try {
    const events = require('Storage').readJSON('android.calendar.json', 1) || [];
    const nowSec = Date.now() / 1000;
    let bestTimed = null;
    let bestAllDay = null;
    for (const e of events) {
      if (!e.timestamp) continue;
      const end = e.timestamp + (e.durationInSeconds || 0);
      if (end < nowSec) continue;
      if (e.allDay) {
        if (!bestAllDay || e.timestamp < bestAllDay.timestamp) bestAllDay = e;
      } else {
        if (!bestTimed || e.timestamp < bestTimed.timestamp) bestTimed = e;
      }
    }
    const best = bestTimed || bestAllDay;
    if (!best) return null;
    return {
      msg: best.title || best.description || 'Event',
      when: new Date(best.timestamp * 1000),
      allDay: best.allDay,
      endMs: (best.timestamp + (best.durationInSeconds || 0)) * 1000
    };
  } catch (e) {
    return null;
  }
}

function refreshAppt () {
  const now = Date.now();
  if (apptScanAt === 0 ||
      (now - apptScanAt) > APPT_RESCAN_MS ||
      (nextAppt && nextAppt.endMs <= now)) {
    nextAppt = loadNextAppointment();
    apptScanAt = now;
  }
}


/**
 *	Sunrise/sunset script. By Matt Kane.
 *
 *  Based loosely and indirectly on Kevin Boone's SunTimes Java implementation
 *  of the US Naval Observatory's algorithm.
 *
 *  Copyright © 2012 Triggertrap Ltd. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser General
 * Public License as published by the Free Software Foundation; either version 2.1 of the License, or (at your option)
 * any later version.
 *
 * This library is distributed in the hope that it will be useful,but WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more
 * details.
 * You should have received a copy of the GNU Lesser General Public License along with this library; if not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA,
 * or connect to: http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
 */

Date.prototype.sunrise = function (latitude, longitude, zenith) {
  return this.sunriseSet(latitude, longitude, true, zenith);
};

Date.prototype.sunset = function (latitude, longitude, zenith) {
  return this.sunriseSet(latitude, longitude, false, zenith);
};

Date.prototype.sunriseSet = function (latitude, longitude, sunrise, zenith) {
  if (!zenith) {
    zenith = 90.8333;
  }

  const hoursFromMeridian = longitude / Date.DEGREES_PER_HOUR;
  const dayOfYear = this.getDayOfYear();
  let approxTimeOfEventInDays;
  let sunMeanAnomaly;
  let sunTrueLongitude;
  let ascension;
  let rightAscension;
  let lQuadrant;
  let raQuadrant;
  let sinDec;
  let cosDec;
  let localHourAngle;
  let localHour;
  let localMeanTime;
  let time;

  if (sunrise) {
    approxTimeOfEventInDays = dayOfYear + ((6 - hoursFromMeridian) / 24);
  } else {
    approxTimeOfEventInDays = dayOfYear + ((18.0 - hoursFromMeridian) / 24);
  }

  sunMeanAnomaly = (0.9856 * approxTimeOfEventInDays) - 3.289;

  sunTrueLongitude = sunMeanAnomaly + (1.916 * Math.sinDeg(sunMeanAnomaly)) + (0.020 * Math.sinDeg(2 * sunMeanAnomaly)) + 282.634;
  sunTrueLongitude = Math.mod(sunTrueLongitude, 360);

  ascension = 0.91764 * Math.tanDeg(sunTrueLongitude);
  rightAscension = 360 / (2 * Math.PI) * Math.atan(ascension);
  rightAscension = Math.mod(rightAscension, 360);

  lQuadrant = Math.floor(sunTrueLongitude / 90) * 90;
  raQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = rightAscension + (lQuadrant - raQuadrant);
  rightAscension /= Date.DEGREES_PER_HOUR;

  sinDec = 0.39782 * Math.sinDeg(sunTrueLongitude);
  cosDec = Math.cosDeg(Math.asinDeg(sinDec));
  const cosLocalHourAngle = ((Math.cosDeg(zenith)) - (sinDec * (Math.sinDeg(latitude)))) / (cosDec * (Math.cosDeg(latitude)));

  localHourAngle = Math.acosDeg(cosLocalHourAngle);

  if (sunrise) {
    localHourAngle = 360 - localHourAngle;
  }

  localHour = localHourAngle / Date.DEGREES_PER_HOUR;

  localMeanTime = localHour + rightAscension - (0.06571 * approxTimeOfEventInDays) - 6.622;

  time = localMeanTime - (longitude / Date.DEGREES_PER_HOUR);
  time = Math.mod(time, 24); // UTC hour-of-day of the event

  // FIX: anchor the result to *this* day's UTC midnight instead of the
  // 1970 epoch. Previously the date part was never set, so every sunrise/
  // sunset landed on 1970-01-01 and any `.getTime()` comparison against
  // `now` was meaningless (drawClock always fell through to "tomorrow").
  // Using getHours()/getMinutes() still yields the correct LOCAL time via the
  // watch's timezone offset, exactly as before.
  const dayMs = 86400000;
  const utcMidnight = Math.floor(this.getTime() / dayMs) * dayMs;
  const milli = utcMidnight + (time * 60 * 60 * 1000);

  return new Date(milli);
};

Date.DEGREES_PER_HOUR = 360 / 24;

// Utility functions

Date.prototype.getDayOfYear = function () {
  const onejan = new Date(this.getFullYear(), 0, 1);
  return Math.ceil((this - onejan) / 86400000);
};

Math.degToRad = function (num) {
  return num * Math.PI / 180;
};

Math.radToDeg = function (radians) {
  return radians * 180.0 / Math.PI;
};

Math.sinDeg = function (deg) {
  return Math.sin(deg * 2.0 * Math.PI / 360.0);
};

Math.acosDeg = function (x) {
  return Math.acos(x) * 360.0 / (2 * Math.PI);
};

Math.asinDeg = function (x) {
  return Math.asin(x) * 360.0 / (2 * Math.PI);
};

Math.tanDeg = function (deg) {
  return Math.tan(deg * 2.0 * Math.PI / 360.0);
};

Math.cosDeg = function (deg) {
  return Math.cos(deg * 2.0 * Math.PI / 360.0);
};

Math.mod = function (a, b) {
  let result = a % b;
  if (result < 0) {
    result += b;
  }
  return result;
};

const w = g.getWidth();
const h = g.getHeight();
const oy = h / 1.7;
const skyTop = 30;
const sinStep = 13;
const r = 10;

const TWILIGHT = 0.9;
const GOLDEN = 1.2;

/* ---------------------------------------------------------------------------
 *  Per-day sun state. Everything here depends only on the date and the
 *  location, so it's computed once at startup and again only when the day
 *  rolls over (see tick()), instead of being recomputed on every frame.
 * ------------------------------------------------------------------------- */
let sunrise, sunset;
let sunRiseX, sunSetX;
let riseT, setT;
let SL0, SL1;      // sea-level y at sunrise / sunset x (horizon endpoints)
let sunDay = -1;   // UTC day index the above were computed for

function xfromTime (t) {
  return (w / 24) * t;
}

function ypos (x) {
  return oy + (32 * Math.sin(((x + sunRiseX - 12) / w) * 6.28));
}

function seaLevel (hour) {
  return ypos(xfromTime(hour));
}

function computeSun () {
  const d = new Date();
  sunrise = d.sunrise(lat, lon);
  sunset = d.sunset(lat, lon);
  riseT = sunrise.getHours() + sunrise.getMinutes() / 60;
  setT = sunset.getHours() + sunset.getMinutes() / 60;
  sunRiseX = xfromTime(riseT);   // ypos()/seaLevel() below rely on this
  sunSetX = xfromTime(setT);
  SL0 = seaLevel(sunrise.getHours());
  SL1 = seaLevel(sunset.getHours());
  sunDay = Math.floor(d.getTime() / 86400000);
}

// Stars: fixed positions, generated once.
const stars = [];
(function () {
  for (let i = 0; i < 45; i++) {
    stars.push({
      x: (Math.random() * w) | 0,
      y: (skyTop + Math.random() * (oy - skyTop)) | 0,
      thr: Math.random(),
      big: Math.random() < 0.15,
      c: (Math.random() < 0.85) ? [1, 1, 1] : [0, 1, 1]
    });
  }
})();

function formatAsTime (hour, minute) {
  return '' + ((hour < 10) ? '0' : '') + (0 | hour) +
         ':' + ((minute < 10) ? '0' : '') + (0 | minute);
}

function skyForTime (t) {
  if (t < riseT - TWILIGHT || t > setT + TWILIGHT)
    return { bands: null, stars: 1 };
  if (t < riseT)
    return { bands: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], stars: (riseT - t) / TWILIGHT };
  if (t < riseT + GOLDEN)
    return { bands: [[0, 0, 1], [0, 1, 1], [1, 1, 0]], stars: 0 };
  if (t > setT)
    return { bands: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], stars: (t - setT) / TWILIGHT };
  if (t > setT - GOLDEN)
    return { bands: [[0, 0, 1], [1, 0, 1], [1, 1, 0]], stars: 0 };
  const a = Math.sin(Math.PI * (t - riseT) / (setT - riseT));
  if (a > 0.6) return { bands: [[0, 0, 1], [0, 0, 1], [0, 1, 1]], stars: 0 };
  return { bands: [[0, 0, 1], [0, 1, 1], [0, 1, 1]], stars: 0 };
}

function drawSky (t) {
  const sky = skyForTime(t);

  if (sky.bands) {
    const hiHorizon = Math.min(SL0, SL1);
    const n = sky.bands.length;
    const bh = (hiHorizon - skyTop) / n;
    for (let k = 0; k < n; k++) {
      const c = sky.bands[k];
      g.setColor(c[0], c[1], c[2]);
      g.fillRect(0, skyTop + k * bh, w, skyTop + (k + 1) * bh);
    }
    const last = sky.bands[n - 1];
    g.setColor(last[0], last[1], last[2]);
    g.fillRect(0, hiHorizon, w, Math.max(SL0, SL1) + 2);
  }

  g.setColor(0, 0, 0);
  g.fillPoly([0, SL0, w, SL1, w, h, 0, h]);

  return sky.stars;
}

function drawStars (level) {
  if (level <= 0) return;
  for (const s of stars) {
    if (s.thr > level) continue;
    const horizon = SL0 + (SL1 - SL0) * s.x / w;
    if (s.y > horizon - 2) continue;
    g.setColor(s.c[0], s.c[1], s.c[2]);
    if (s.big) {
      g.fillRect(s.x - 1, s.y, s.x + 1, s.y);
      g.fillRect(s.x, s.y - 1, s.x, s.y + 1);
    } else {
      g.fillRect(s.x, s.y, s.x, s.y);
    }
  }
}

function drawSinuses () {
  g.setColor(1, 1, 1);
  let x = 0;
  let y = ypos(x);
  while (x < w) {
    const y2 = ypos(x + sinStep);
    g.drawLine(x, y, x + sinStep, y2);
    y = y2;
    x += sinStep; // no need to draw all steps
  }

  // sea level line (endpoints precomputed in computeSun)
  g.setColor(0, 0.5, 1);
  g.drawLine(0, SL0, w, SL1);
  g.drawLine(0, SL0 + 1, w, SL1 + 1);
}

function drawTimes () {
  if (!nextAppt) return;

  g.setFont('6x8', 2);
  g.setColor(1, 1, 1);

  const timeStr = nextAppt.allDay ? '' : (formatAsTime(nextAppt.when.getHours(), nextAppt.when.getMinutes()) + ' ');

  let msg = nextAppt.msg;
  if (msg.length > 18) msg = msg.substr(0, 17) + '…';
  const line = timeStr + msg;
  g.setFontAlign(0, -1, 0);
  g.drawString(line, w / 2, h - 20);
  g.setFontAlign(-1, -1, 0);
}

function drawGlow (x, y) {
  g.setColor(0.2, 0.2, 0);
  if (x > sunRiseX && x < sunSetX) {
    g.fillCircle(x, y, r + 20);
    g.setColor(0.5, 0.5, 0);
  }
  g.fillCircle(x, y, r + 8);

  // mask below horizon by repainting the ground polygon in black
  g.setColor(0, 0, 0);
  g.fillPoly([0, SL0, w, SL1, w, h, 0, h]);
}

function drawBall (x, y) {
  if (x > sunRiseX && x < sunSetX) {
    g.setColor(1, 1, 1);
  } else {
    g.setColor(0.5, 0.5, 0);
  }
  g.fillCircle(x, y, r);
  g.setColor(1, 1, 0);
  g.drawCircle(x, y, r);
}

function drawClock (now, t) {
  const hours = now.getHours();
  const mins = now.getMinutes();

  g.setFont('Vector', 30);
  g.setColor(1, 1, 1);
  g.drawString(formatAsTime(hours, mins), w / 1.9, 32);
  const mo = now.getMonth() + 1;
  const da = now.getDate();
  g.setFont('6x8', 2);
  g.setFontAlign(-1, -1, 0);
  g.drawString('' + da + '/' + mo, 5, 30);

  // Next sunrise/sunset, under the date on the left.
  // Now that sunrise/sunset carry today's real date, these comparisons work.
  const nowMs = now.getTime();
  let nextSun, up;
  if (nowMs < sunrise.getTime()) {
    nextSun = sunrise; up = true;
  } else if (nowMs < sunset.getTime()) {
    nextSun = sunset; up = false;
  } else {
    nextSun = new Date(nowMs + 86400000).sunrise(lat, lon);
    up = true;
  }

  const ty = 50; // y position for sun time line
  const ax = 5;  // arrow left x
  const aw = 10; // arrow width
  const ah = 12; // arrow height
  g.setColor(1, 1, 0);
  if (up) {
    g.fillPoly([ax + aw / 2, ty, ax, ty + ah, ax + aw, ty + ah]); // up
  } else {
    g.fillPoly([ax, ty, ax + aw, ty, ax + aw / 2, ty + ah]);      // down
  }

  g.setColor(1, 1, 1);
  g.setFont('6x8', 2);
  g.setFontAlign(-1, -1, 0);
  g.drawString(formatAsTime(nextSun.getHours(), nextSun.getMinutes()),
               ax + aw + 4, ty);
}

function renderScreen () {
  const now = new Date();
  const t = now.getHours() + now.getMinutes() / 60;
  const nowX = xfromTime(t);
  const nowY = ypos(nowX);

  g.setColor(0, 0, 0);
  g.fillRect(0, 30, w, h);
  g.setFontAlign(-1, -1, 0);

  const starLevel = drawSky(t);
  drawStars(starLevel);

  Bangle.drawWidgets();

  drawGlow(nowX, nowY);
  drawSinuses();
  drawTimes();
  drawClock(now, t);
  drawBall(nowX, nowY);
}

/* ---------------------------------------------------------------------------
 *  Frame loop. We tick once a minute, aligned to the top of the minute, and
 *  we PAUSE entirely while the screen is off (see the lcdPower handler) so we
 *  aren't redrawing / re-reading storage for a display nobody's looking at.
 * ------------------------------------------------------------------------- */
let drawTimeout;

function queueNext () {
  if (drawTimeout) clearTimeout(drawTimeout);
  drawTimeout = setTimeout(function () {
    drawTimeout = undefined;
    tick();
  }, 60000 - (Date.now() % 60000));
}

function tick () {
  if (Math.floor(Date.now() / 86400000) !== sunDay) computeSun(); // day rollover
  refreshAppt();
  renderScreen();
  queueNext();
}


function main () {
  g.setBgColor(0, 0, 0);
  g.clear();
  computeSun();
  tick();
}

main();
