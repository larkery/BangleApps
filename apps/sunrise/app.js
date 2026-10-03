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
 *  watch face does, so we do NOT do it every minute. Every APPT_RESCAN_MS we
 *  pull out the handful of events that could become "next" before the
 *  following scan, and each minute we just pick from that short list. That
 *  way the one-day look-ahead window slides smoothly between scans.
 * ------------------------------------------------------------------------- */
const APPT_RESCAN_MS = 10 * 60 * 1000;      // 10 minutes
const APPT_WINDOW_MS = 24 * 60 * 60 * 1000; // only show events starting within a day
let appts = [];
let apptScanAt = 0;

function scanAppointments () {
  const list = [];
  try {
    const events = require('Storage').readJSON('android.calendar.json', 1) || [];
    const nowSec = Date.now() / 1000;
    const latest = nowSec + (APPT_WINDOW_MS + APPT_RESCAN_MS) / 1000;
    for (const e of events) {
      if (!e.timestamp || e.timestamp > latest) continue;
      const end = e.timestamp + (e.durationInSeconds || 0);
      if (end <= nowSec) continue;
      list.push({
        msg: e.title || e.description || 'Event',
        start: e.timestamp * 1000,
        end: end * 1000,
        allDay: !!e.allDay
      });
    }
  } catch (e) { }
  return list;
}

function refreshAppts () {
  const now = Date.now();
  if (apptScanAt === 0 || (now - apptScanAt) > APPT_RESCAN_MS) {
    appts = scanAppointments();
    apptScanAt = now;
  }
}

// Earliest timed event that hasn't ended and starts within the window;
// all-day events only if there's no timed one.
function nextAppointment (nowMs) {
  let bestTimed = null;
  let bestAllDay = null;
  for (const a of appts) {
    if (a.end <= nowMs || a.start > nowMs + APPT_WINDOW_MS) continue;
    if (a.allDay) {
      if (!bestAllDay || a.start < bestAllDay.start) bestAllDay = a;
    } else {
      if (!bestTimed || a.start < bestTimed.start) bestTimed = a;
    }
  }
  return bestTimed || bestAllDay;
}

/* ---------------------------------------------------------------------------
 *  Weather, from the weather app's weather.json. Only re-read alongside the
 *  calendar, and ignored once it's stale.
 * ------------------------------------------------------------------------- */
const WEATHER_MAX_AGE_MS = 3 * 60 * 60 * 1000;
let weather = null;

// Turn an OpenWeatherMap condition code (or the text, if there's no code)
// into what we draw: number of clouds, precipitation type and fog.
function weatherScene (code, txt) {
  txt = (txt || '').toLowerCase();
  if (!code) {
    if (txt.indexOf('thunder') >= 0) code = 200;
    else if (txt.indexOf('snow') >= 0 || txt.indexOf('sleet') >= 0) code = 600;
    else if (txt.indexOf('rain') >= 0 || txt.indexOf('shower') >= 0) code = 500;
    else if (txt.indexOf('drizzle') >= 0) code = 300;
    else if (txt.indexOf('fog') >= 0 || txt.indexOf('mist') >= 0 || txt.indexOf('haze') >= 0) code = 741;
    else if (txt.indexOf('overcast') >= 0) code = 804;
    else if (txt.indexOf('cloud') >= 0) code = 802;
    else return null;
  }
  if (code < 300) return { clouds: 4, precip: 'rain', storm: true };
  if (code < 400) return { clouds: 3, precip: 'drizzle' };
  if (code < 600) return { clouds: 4, precip: 'rain' };
  if (code < 700) return { clouds: 4, precip: 'snow' };
  if (code < 800) return { clouds: 0, fog: true };
  if (code === 800) return null;
  return { clouds: Math.min(code - 800, 4) };
}

function loadWeather () {
  try {
    const json = require('Storage').readJSON('weather.json', 1);
    const wx = json && json.weather;
    if (!wx || (wx.time && Date.now() - wx.time > WEATHER_MAX_AGE_MS)) return null;
    return {
      scene: weatherScene(wx.code, wx.txt),
      temp: (wx.temp !== undefined) ? wx.temp - 273.15 : undefined // stored in Kelvin
    };
  } catch (e) {
    return null;
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
const amp = 32;    // height of the sun's daily sine path
const skyTop = 30;
const sinStep = 11;
const rUp = 8;     // sun radius above the horizon
const rDown = 5;   // ...and below it

const TWILIGHT = 0.9;
const GOLDEN = 1.2;

/* ---------------------------------------------------------------------------
 *  Per-day sun state. Everything here depends only on the date and the
 *  location, so it's computed once at startup and again only when the day
 *  rolls over (see tick()), instead of being recomputed on every frame.
 *
 *  The sun's path peaks at solar noon (midway between sunrise and sunset),
 *  and since it's symmetric the horizon is flat and crosses the path exactly
 *  at sunrise and sunset - so long summer days give a high arc, short winter
 *  days a shallow one.
 * ------------------------------------------------------------------------- */
let sunrise, sunset;
let sunRiseX, sunSetX, noonX;
let riseT, setT;
let horizon;       // y of the horizon
let sunDay = -1;   // UTC day index the above were computed for

function xfromTime (t) {
  return (w / 24) * t;
}

function ypos (x) {
  return oy - amp * Math.cos(((x - noonX) / w) * 2 * Math.PI);
}

function computeSun () {
  const d = new Date();
  sunrise = d.sunrise(lat, lon);
  sunset = d.sunset(lat, lon);
  riseT = sunrise.getHours() + sunrise.getMinutes() / 60;
  setT = sunset.getHours() + sunset.getMinutes() / 60;
  sunRiseX = xfromTime(riseT);
  sunSetX = xfromTime(setT);
  noonX = (sunRiseX + sunSetX) / 2;
  horizon = Math.round(ypos(sunRiseX));
  if (!(horizon > 0)) { // polar day/night: sunrise is NaN, fall back to noon at 12
    noonX = w / 2;
    horizon = oy;
  }
  sunDay = Math.floor(d.getTime() / 86400000);
}

// Stars: fixed positions, generated once.
const stars = [];
(function () {
  for (let i = 0; i < 45; i++) {
    stars.push({
      x: (Math.random() * w) | 0,
      y: (skyTop + Math.random() * (oy + amp / 2 - skyTop)) | 0,
      thr: Math.random(),
      big: Math.random() < 0.15,
      c: (Math.random() < 0.85) ? [1, 1, 1] : [0, 1, 1]
    });
  }
})();

// Fixed cloud positions [x, y, scale], in the order they get added as the
// sky gets cloudier. Kept low in the sky, under the text where possible, and
// clipped to the horizon.
const CLOUDS = [[40, 76, 1], [118, 80, 1.1], [86, 71, 0.7], [158, 92, 0.8]];

function formatAsTime (hour, minute) {
  return '' + ((hour < 10) ? '0' : '') + (0 | hour) +
         ':' + ((minute < 10) ? '0' : '') + (0 | minute);
}

// Draw text with a 1px black outline so it stays readable over the sky,
// clouds and rain.
function drawOutlined (str, x, y) {
  g.setColor(0, 0, 0);
  g.drawString(str, x - 1, y);
  g.drawString(str, x + 1, y);
  g.drawString(str, x, y - 1);
  g.drawString(str, x, y + 1);
  g.setColor(1, 1, 1);
  g.drawString(str, x, y);
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

function drawSky (sky) {
  if (sky.bands) {
    const n = sky.bands.length;
    const bh = (horizon - skyTop) / n;
    for (let k = 0; k < n; k++) {
      const c = sky.bands[k];
      g.setColor(c[0], c[1], c[2]);
      g.fillRect(0, skyTop + k * bh, w, skyTop + (k + 1) * bh);
    }
  }
  drawGround();
}

function drawGround () {
  g.setColor(0, 0, 0);
  g.fillRect(0, horizon, w, h);
}

function drawStars (level) {
  if (level <= 0) return;
  for (const s of stars) {
    if (s.thr > level || s.y > horizon - 3) continue;
    g.setColor(s.c[0], s.c[1], s.c[2]);
    if (s.big) {
      g.fillRect(s.x - 1, s.y, s.x + 1, s.y);
      g.fillRect(s.x, s.y - 1, s.x, s.y + 1);
    } else {
      g.setPixel(s.x, s.y);
    }
  }
}

function drawCloud (x, y, s, dark) {
  g.setColor(0, 0, dark ? 1 : 0.5);
  g.fillCircle(x - 9 * s, y + 1, 6 * s);
  g.fillCircle(x, y - 3 * s, 9 * s);
  g.fillCircle(x + 10 * s, y + 1, 6 * s);
  g.fillRect(x - 9 * s, y + 1, x + 10 * s, y + 7 * s);
  g.setColor(dark ? 0 : 1, dark ? 0 : 1, 1);
  g.fillCircle(x - 9 * s, y, 5 * s);
  g.fillCircle(x, y - 4 * s, 8 * s);
  g.fillCircle(x + 10 * s, y, 5 * s);
  g.fillRect(x - 9 * s, y, x + 10 * s, y + 5 * s);
}

// Weather goes in the sky behind the text: clouds, then rain/snow falling
// from them down to the horizon, a lightning bolt, or bands of fog.
function drawWeather (night) {
  const sc = weather && weather.scene;
  if (!sc) return;
  g.setClipRect(0, skyTop, w - 1, horizon - 1);

  if (sc.precip) {
    const top = 56;
    const span = horizon - top - 2;
    const n = sc.precip === 'drizzle' ? 18 : 30;
    g.setColor(night && sc.precip !== 'snow' ? 0 : 1, 1, 1);
    for (let i = 0; i < n && span > 0; i++) {
      const x = (i * 47 + 5) % w;
      const y = top + (i * 29) % span;
      if (sc.precip === 'snow') g.fillRect(x, y, x + 1, y + 1);
      else g.drawLine(x, y, x - 2, y + (sc.precip === 'drizzle' ? 3 : 6));
    }
  }

  for (let i = 0; i < sc.clouds; i++) {
    const c = CLOUDS[i];
    drawCloud(c[0], c[1], c[2], night);
  }

  if (sc.storm) {
    const x = CLOUDS[1][0] - 4;
    const y = CLOUDS[1][1] + 8;
    g.setColor(1, 1, 0);
    g.fillPoly([x + 4, y, x - 4, y + 13, x + 1, y + 13, x - 3, y + 24,
                x + 9, y + 9, x + 3, y + 9, x + 8, y]);
  }

  if (sc.fog) {
    g.setColor(night ? 0 : 1, night ? 0 : 1, 1);
    for (let k = 1; k <= 4; k++) {
      const y = horizon - 5 * k;
      if (y < skyTop) break;
      for (let x = (k * 7) % 20 - 20; x < w; x += 20) g.fillRect(x, y, x + 12, y + 1);
    }
  }
  g.setClipRect(0, 0, w - 1, h - 1);
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

  // sea level line
  g.setColor(0, 0.5, 1);
  g.fillRect(0, horizon, w, horizon + 1);
}

/* Next calendar event, along the bottom. Centred if it fits on one line,
 * otherwise wrapped (up to APPT_LINES lines) and left-aligned. The start time
 * is yellow, prefixed with a cyan "Tmw" if it's tomorrow. */
const APPT_LINES = 2;

function drawAppt (nowMs) {
  const a = nextAppointment(nowMs);
  if (!a) return;

  const when = new Date(a.start);
  const tomorrow = a.start > nowMs && when.getDate() !== new Date(nowMs).getDate();
  const tmwStr = tomorrow ? 'Tmw ' : '';
  const timeStr = a.allDay ? '' : formatAsTime(when.getHours(), when.getMinutes()) + ' ';

  g.setFont('6x15');
  g.setFontAlign(-1, -1, 0);
  const maxW = w - 8;
  let lines = g.wrapString(tmwStr + timeStr + a.msg, maxW);
  if (lines.length > APPT_LINES) {
    lines = lines.slice(0, APPT_LINES);
    let last = lines[APPT_LINES - 1];
    while (last.length && g.stringWidth(last + '...') > maxW) last = last.slice(0, -1);
    lines[APPT_LINES - 1] = last.trim() + '...';
  }

  const lh = g.getFontHeight();
  const x = (lines.length === 1) ? ((w - g.stringWidth(lines[0])) / 2) | 0 : 4;
  let y = h - lines.length * lh - 1;

  g.setColor(1, 1, 1);
  for (let i = 0; i < lines.length; i++) g.drawString(lines[i], x, y + i * lh);
  // recolour the prefix on the first line by drawing over it
  if (lines[0].indexOf(tmwStr + timeStr) === 0) {
    g.setColor(0, 1, 1);
    g.drawString(tmwStr, x, y);
    g.setColor(1, 1, 0);
    g.drawString(timeStr, x + g.stringWidth(tmwStr), y);
  }
}

function drawGlow (x, y, up) {
  if (!up) return;
  g.setColor(0.5, 0.5, 0);
  g.fillCircle(x, y, rUp + 6);
  drawGround(); // mask below the horizon
}

function drawBall (x, y, up) {
  if (up) {
    g.setColor(1, 1, 1);
    g.fillCircle(x, y, rUp);
    g.setColor(1, 1, 0);
    g.drawCircle(x, y, rUp);
  } else {
    g.setColor(0, 0, 0);
    g.fillCircle(x, y, rDown);
    g.setColor(1, 1, 0);
    g.drawCircle(x, y, rDown);
  }
}

function drawClock (now) {
  g.setFontAlign(-1, -1, 0);
  g.setFont('Vector', 30);
  drawOutlined(formatAsTime(now.getHours(), now.getMinutes()), w / 1.9, 32);
  g.setFont('6x8', 2);
  drawOutlined('' + now.getDate() + '/' + (now.getMonth() + 1), 5, 30);

  // Next sunrise/sunset, under the date on the left.
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
  const arrow = up ? [ax + aw / 2, ty, ax, ty + ah, ax + aw, ty + ah]
                   : [ax, ty, ax + aw, ty, ax + aw / 2, ty + ah];
  g.setColor(0, 0, 0);
  g.drawPoly(arrow, true);
  g.setColor(1, 1, 0);
  g.fillPoly(arrow);
  if (!isNaN(nextSun.getTime()))
    drawOutlined(formatAsTime(nextSun.getHours(), nextSun.getMinutes()), ax + aw + 4, ty);

  // Temperature, under the time on the right.
  if (weather && weather.temp !== undefined) {
    let str;
    try {
      str = require('locale').temp(weather.temp, 0);
    } catch (e) {
      str = Math.round(weather.temp) + '\'C';
    }
    g.setFont('6x15');
    g.setFontAlign(1, -1, 0);
    drawOutlined(str, w - 4, 64);
    g.setFontAlign(-1, -1, 0);
  }
}

function renderScreen () {
  const now = new Date();
  const t = now.getHours() + now.getMinutes() / 60;
  const nowX = xfromTime(t);
  const nowY = ypos(nowX);
  const up = nowY < horizon;
  const sky = skyForTime(t);

  g.reset();
  g.setColor(0, 0, 0);
  g.fillRect(0, skyTop, w, h);

  drawSky(sky);
  // can't see the stars through heavy cloud
  const sc = weather && weather.scene;
  if (!sc || (sc.clouds < 3 && !sc.precip)) drawStars(sky.stars);
  drawGlow(nowX, nowY, up);
  drawWeather(sky.stars > 0);
  drawSinuses();
  drawBall(nowX, nowY, up);
  drawAppt(now.getTime());
  drawClock(now);
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
  const scanned = apptScanAt;
  refreshAppts();
  if (apptScanAt !== scanned) weather = loadWeather(); // same cadence as calendar
  renderScreen();
  queueNext();
}

Bangle.on('lcdPower', function (on) {
  if (on) {
    tick();
  } else if (drawTimeout) {
    clearTimeout(drawTimeout);
    drawTimeout = undefined;
  }
});

function main () {
  g.setBgColor(0, 0, 0);
  g.clear();
  Bangle.drawWidgets();
  computeSun();
  tick();
}

main();
