// banglejs app made by pancake
// hacks by claude
// sunrise/sunset script by Matt Kane from https://github.com/Triggertrap/sun-js

// Everything lives in this block so the clock can be fast-loaded: nothing
// leaks into the global scope, and setUI's remove() undoes what we set up.
{
const storage = require('Storage');

const settings = Object.assign({
  weather: true,   // clouds/rain etc in the sky, and rain forecast on the axis
  calendar: true,  // next event at the bottom, and events on the axis
  moon: true
}, storage.readJSON('sunrise.json', 1) || {});
const is12h = (storage.readJSON('setting.json', 1) || {})['12hour'];

// requires the myLocation app
const latlon = storage.readJSON('mylocation.json', 1) || {};
const lat = latlon.lat || 41.38;
const lon = latlon.lon || 2.168;

/* ---------------------------------------------------------------------------
 *  Calendar cache
 *  Reading + parsing the calendar JSON is the single most expensive thing this
 *  watch face does, so we do NOT do it every minute. Every RESCAN_MS we pull
 *  out the handful of events that could be relevant before the following
 *  scan, and each minute we just pick from that short list. That way the
 *  one-day look-ahead window slides smoothly between scans.
 * ------------------------------------------------------------------------- */
const RESCAN_MS = 10 * 60 * 1000;          // 10 minutes
const WINDOW_MS = 24 * 60 * 60 * 1000;     // only show things within a day
let appts = [];
let scanAt = 0;

const scanAppointments = function () {
  const list = [];
  if (!settings.calendar) return list;
  try {
    const events = storage.readJSON('android.calendar.json', 1) || [];
    const nowSec = Date.now() / 1000;
    const latest = nowSec + (WINDOW_MS + RESCAN_MS) / 1000;
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
  list.sort((a, b) => a.start - b.start);
  return list;
};

// Events that haven't ended and start within the window, soonest first.
const upcoming = function (nowMs) {
  return appts.filter(a => a.end > nowMs && a.start <= nowMs + WINDOW_MS);
};

// The one to show at the bottom: the next timed event, or failing that the
// next all-day one.
const nextAppointment = function (list) {
  return list.find(a => !a.allDay) || list[0];
};

/* ---------------------------------------------------------------------------
 *  Weather, from the weather app. Re-read alongside the calendar, and
 *  ignored once it's stale. If the weather app is set to fetch forecasts we
 *  also pick out the hours when rain is expected.
 * ------------------------------------------------------------------------- */
const WEATHER_MAX_AGE_MS = 3 * 60 * 60 * 1000;
let weather = null;

// Is an OpenWeatherMap condition code some kind of precipitation?
const isWet = function (code) {
  return code >= 200 && code < 700;
};

// Turn an OpenWeatherMap condition code (or the text, if there's no code)
// into what we draw: number of clouds, precipitation type and fog.
const weatherScene = function (code, txt) {
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
};

const loadWeather = function () {
  if (!settings.weather) return null;
  try {
    let wx;
    if (storage.read('weather') !== undefined) {
      wx = require('weather').getWeather(true); // decodes forecasts, if enabled
    } else {
      const json = storage.readJSON('weather.json', 1);
      wx = json && json.weather;
    }
    if (!wx || (wx.time && Date.now() - wx.time > WEATHER_MAX_AGE_MS)) return null;

    // [startMs, endMs] spans when the hourly forecast says rain
    const rain = [];
    const fc = wx.hourfcast;
    if (fc && fc.time) {
      for (let i = 0; i < fc.time.length; i++) {
        if (!isWet(fc.code[i]) && !(fc.rain && fc.rain[i] >= 50)) continue;
        const start = fc.time[i] * 1000;
        const end = (i + 1 < fc.time.length) ? fc.time[i + 1] * 1000 : start + 3600000;
        rain.push([start, end]);
      }
    }
    return { scene: weatherScene(wx.code, wx.txt), rain: rain };
  } catch (e) {
    return null;
  }
};

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

const DEG = Math.PI / 180;
const DEGREES_PER_HOUR = 360 / 24;
const sinDeg = d => Math.sin(d * DEG);
const cosDeg = d => Math.cos(d * DEG);
const tanDeg = d => Math.tan(d * DEG);
const asinDeg = x => Math.asin(x) / DEG;
const acosDeg = x => Math.acos(x) / DEG;
const mod = function (a, b) {
  const result = a % b;
  return (result < 0) ? result + b : result;
};

const dayOfYear = function (date) {
  const onejan = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((date - onejan) / 86400000);
};

// Time on `date`'s (UTC) day that the sun crosses `zenith` degrees, rising or
// setting. 90.8333 is sunrise/sunset, 96 is civil dawn/dusk. Invalid date if
// it doesn't happen that day.
const sunTime = function (date, rising, zenith) {
  const hoursFromMeridian = lon / DEGREES_PER_HOUR;
  const approxTimeOfEventInDays = dayOfYear(date) + (((rising ? 6 : 18) - hoursFromMeridian) / 24);

  const sunMeanAnomaly = (0.9856 * approxTimeOfEventInDays) - 3.289;

  let sunTrueLongitude = sunMeanAnomaly + (1.916 * sinDeg(sunMeanAnomaly)) + (0.020 * sinDeg(2 * sunMeanAnomaly)) + 282.634;
  sunTrueLongitude = mod(sunTrueLongitude, 360);

  let rightAscension = mod(Math.atan(0.91764 * tanDeg(sunTrueLongitude)) / DEG, 360);
  const lQuadrant = Math.floor(sunTrueLongitude / 90) * 90;
  const raQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = (rightAscension + (lQuadrant - raQuadrant)) / DEGREES_PER_HOUR;

  const sinDec = 0.39782 * sinDeg(sunTrueLongitude);
  const cosDec = cosDeg(asinDeg(sinDec));
  const cosLocalHourAngle = (cosDeg(zenith) - (sinDec * sinDeg(lat))) / (cosDec * cosDeg(lat));

  let localHourAngle = acosDeg(cosLocalHourAngle);
  if (rising) localHourAngle = 360 - localHourAngle;

  const localMeanTime = localHourAngle / DEGREES_PER_HOUR + rightAscension - (0.06571 * approxTimeOfEventInDays) - 6.622;
  const time = mod(localMeanTime - hoursFromMeridian, 24); // UTC hour-of-day of the event

  // anchor the result to this day's UTC midnight
  const dayMs = 86400000;
  return new Date(Math.floor(date.getTime() / dayMs) * dayMs + time * 3600000);
};

/* ------------------------------------------------------------------------- */

const w = g.getWidth();
const h = g.getHeight();
const oy = h / 1.7;
const amp = 32;    // height of the sun's daily sine path
const skyTop = 24;
const rUp = 8;     // sun radius above the horizon
const rDown = 5;   // ...and below it
const rMoon = 6;
const GOLDEN = 1.2;          // hours either side of sunrise/sunset
const FALLBACK_TWILIGHT = 0.9;

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
let noonX;
let riseT, setT, dawnT, duskT;
let horizon;       // y of the horizon
let sunDay = -1;   // UTC day index the above were computed for

const hourOf = d => d.getHours() + d.getMinutes() / 60;
const xfromTime = t => (w / 24) * t;
const xOfMs = ms => xfromTime(hourOf(new Date(ms)));

const ypos = function (x) {
  return oy - amp * Math.cos(((x - noonX) / w) * 2 * Math.PI);
};

const computeSun = function () {
  const d = new Date();
  sunrise = sunTime(d, true, 90.8333);
  sunset = sunTime(d, false, 90.8333);
  riseT = hourOf(sunrise);
  setT = hourOf(sunset);
  noonX = xfromTime((riseT + setT) / 2);
  horizon = Math.round(ypos(xfromTime(riseT)));
  if (!(horizon > 0)) { // polar day/night: no sunrise, fall back to noon at 12
    noonX = w / 2;
    horizon = oy;
  }
  // civil twilight; doesn't end at all in a summer "white night"
  dawnT = hourOf(sunTime(d, true, 96));
  duskT = hourOf(sunTime(d, false, 96));
  if (isNaN(dawnT) || dawnT > riseT) dawnT = isNaN(riseT) ? 0 : riseT - FALLBACK_TWILIGHT;
  if (isNaN(duskT) || duskT < setT) duskT = isNaN(setT) ? 24 : setT + FALLBACK_TWILIGHT;
  sunDay = Math.floor(d.getTime() / 86400000);
};

// Moon phase: 0 = new, 0.5 = full
const moonPhase = function (ms) {
  return mod((ms - 947182440000) / 86400000 / 29.530588853, 1); // from a known new moon
};

// Stars: fixed positions, generated once.
const stars = [];
for (let i = 0; i < 45; i++) {
  stars.push({
    x: (Math.random() * w) | 0,
    y: (skyTop + Math.random() * (oy + amp / 2 - skyTop)) | 0,
    thr: Math.random(),
    big: Math.random() < 0.15,
    c: (Math.random() < 0.85) ? [1, 1, 1] : [0, 1, 1]
  });
}

// Fixed cloud positions [x, y, scale], in the order they get added as the
// sky gets cloudier. Kept low in the sky, under the text where possible, and
// clipped to the horizon.
const CLOUDS = [[40, 76, 1], [118, 80, 1.1], [86, 71, 0.7], [158, 92, 0.8]];

const pad2 = n => (n < 10 ? '0' : '') + n;
const formatTime = function (d) {
  let hr = d.getHours();
  if (is12h) return '' + (hr % 12 || 12) + ':' + pad2(d.getMinutes());
  return pad2(hr) + ':' + pad2(d.getMinutes());
};

// Draw text with a 1px black outline so it stays readable over the sky,
// clouds, rain and sea.
const drawOutlined = function (str, x, y, col) {
  g.setColor(0, 0, 0);
  g.drawString(str, x - 1, y);
  g.drawString(str, x + 1, y);
  g.drawString(str, x, y - 1);
  g.drawString(str, x, y + 1);
  g.setColor.apply(g, col || [1, 1, 1]);
  g.drawString(str, x, y);
};

const lerp = (a, b, f) => a + (b - a) * f;
const lerpCol = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
const lerpPal = (a, b, f) => a.map((c, i) => lerpCol(c, b[i], f));

/* Sky palettes, top to horizon. The screen only has 8 colours but the
 * firmware dithers anything in between, so we blend between these. */
const PAL_NIGHT = [[0, 0, 0], [0, 0, 0], [0, 0, 0.1], [0, 0, 0.3]];
const PAL_DAWN = [[0, 0, 0.5], [0.6, 0, 0.6], [1, 0.2, 0.4], [1, 0.6, 0]];
const PAL_DAY = [[0, 0, 1], [0, 0.3, 1], [0, 0.7, 1], [0.4, 1, 1]];

// Sky colours and star brightness for an hour of the day.
const skyForTime = function (t) {
  const evening = t > (riseT + setT) / 2;
  const dark = evening ? duskT : dawnT;
  const sun = evening ? setT : riseT;
  // hours of daylight before the sun gets to the horizon (negative = below)
  const above = evening ? sun - t : t - sun;
  if (above < 0) {
    // twilight: night -> dawn colours as the sun approaches the horizon
    const f = Math.max(0, 1 + above / Math.abs(sun - dark));
    return { pal: lerpPal(PAL_NIGHT, PAL_DAWN, f), stars: 1 - f, night: f < 0.5 };
  }
  if (above < GOLDEN) return { pal: lerpPal(PAL_DAWN, PAL_DAY, above / GOLDEN), stars: 0, glow: true };
  return { pal: PAL_DAY, stars: 0 };
};

const drawSky = function (sky) {
  const pal = sky.pal;
  const n = pal.length - 1;
  const step = 3;
  for (let y = skyTop; y < horizon; y += step) {
    const f = (y - skyTop) / (horizon - skyTop) * n;
    const i = Math.min(n - 1, f | 0);
    g.setColor.apply(g, lerpCol(pal[i], pal[i + 1], f - i));
    g.fillRect(0, y, w - 1, Math.min(y + step - 1, horizon - 1));
  }
};

// The ground is a sea: dark blue fading to black, with little wave marks
// that get longer and further apart as they come closer.
const drawSea = function () {
  const depth = Math.min(36, h - horizon);
  for (let y = horizon; y < h; y += 2) {
    const f = Math.max(0, 1 - (y - horizon) / depth);
    g.setColor(0, 0, 0.45 * f);
    g.fillRect(0, y, w - 1, y + 1);
  }
  g.setColor(0, 0.4, 0.8);
  let y = horizon + 14;
  for (let k = 1; y < h; k++) {
    const len = 2 + k;
    const gap = 18 + 7 * k;
    for (let x = (k * 37) % gap - gap; x < w; x += gap) g.fillRect(x, y, x + len, y);
    y += 3 + 2 * k;
  }
};

// A shimmering column on the sea under the sun or moon.
const drawReflection = function (x, col, size) {
  for (let k = 0; k < 9; k++) {
    const y = horizon + 3 + k * 3;
    if (y >= h) break;
    const hw = size * (1 - k / 12) * ((k & 1) ? 0.6 : 1);
    g.setColor.apply(g, lerpCol(col, [0, 0, 0.3], k / 10));
    g.fillRect(x - hw, y, x + hw, y + 1);
  }
};

const drawStars = function (level) {
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
};

const drawCloud = function (x, y, s, top, under) {
  g.setColor.apply(g, under);
  g.fillCircle(x - 9 * s, y + 1, 6 * s);
  g.fillCircle(x, y - 3 * s, 9 * s);
  g.fillCircle(x + 10 * s, y + 1, 6 * s);
  g.fillRect(x - 9 * s, y + 1, x + 10 * s, y + 7 * s);
  g.setColor.apply(g, top);
  g.fillCircle(x - 9 * s, y, 5 * s);
  g.fillCircle(x, y - 4 * s, 8 * s);
  g.fillCircle(x + 10 * s, y, 5 * s);
  g.fillRect(x - 9 * s, y, x + 10 * s, y + 5 * s);
};

// Weather goes in the sky behind the text: clouds, then rain/snow falling
// from them down to the horizon, a lightning bolt, or bands of fog.
const drawWeather = function (sky) {
  const sc = weather && weather.scene;
  if (!sc) return;
  const night = sky.night;

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

  // white with a shadow by day, lit from below near sunrise/sunset, dim blue at night
  const top = night ? [0, 0, 0.7] : [1, 1, 1];
  const under = night ? [0, 0, 0.35] : sky.stars > 0 || sky.glow ? sky.pal[3] : [0.4, 0.4, 0.8];
  for (let i = 0; i < sc.clouds; i++) {
    const c = CLOUDS[i];
    drawCloud(c[0], c[1], c[2], top, under);
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
};

// Moon, with its phase. It sits on the same path as the sun, lagging it by
// the phase (a full moon is opposite the sun), which is close enough here.
const drawMoon = function (x, y, phase, night) {
  if (night) {
    g.setColor(0.2, 0.2, 0.4);
    g.fillCircle(x, y, rMoon);
  }
  const c = Math.cos(phase * 2 * Math.PI);
  g.setColor(1, 1, night ? 0.6 : 1);
  for (let dy = -rMoon; dy <= rMoon; dy++) {
    const hw = Math.sqrt(rMoon * rMoon - dy * dy);
    let a, b;
    if (phase < 0.5) { a = hw * c; b = hw; } else { a = -hw; b = -hw * c; }
    if (lat < 0) { const t = a; a = -b; b = -t; } // lit side is mirrored in the south
    if (b - a >= 0.5) g.fillRect(Math.round(x + a), y + dy, Math.round(x + b), y + dy);
  }
};

// The sun's path: solid for the part of the day that's gone, dotted for
// what's to come, and dim dots where it's below the horizon.
const drawPath = function (nowX) {
  let px = 0;
  let py = ypos(0);
  for (let x = 2; x <= w; x += 2) {
    const y = ypos(x);
    if (y >= horizon) {
      if (x % 6 === 0) { g.setColor(0, 0.5, 1); g.setPixel(x, y); }
    } else if (x <= nowX) {
      g.setColor(1, 1, 1);
      g.drawLine(px, py, x, y);
    } else if (x % 6 === 0) {
      g.setColor(1, 1, 1);
      g.fillRect(x, y, x + 1, y + 1);
    }
    px = x; py = y;
  }
};

// Mark a span of time along the axis below the horizon. The axis is the next
// 24 hours, so anything left of "now" is tomorrow: the part of the span
// before midnight is drawn in col, the part after in tmwCol.
const drawSpan = function (startMs, endMs, nowMs, midMs, y, col, tmwCol) {
  startMs = Math.max(startMs, nowMs);
  endMs = Math.min(endMs, nowMs + WINDOW_MS);
  if (endMs <= startMs) return;
  const bar = function (xs, xe, c) {
    xs = Math.round(xs);
    xe = Math.max(Math.round(xe), xs + 1);
    g.setColor.apply(g, c);
    g.fillRect(xs, y, xe, y + 1);
  };
  if (startMs < midMs) bar(xOfMs(startMs), endMs >= midMs ? w - 1 : xOfMs(endMs), col);
  if (endMs > midMs) bar(startMs > midMs ? xOfMs(startMs) : 0, xOfMs(endMs), tmwCol);
};

// Horizon line with a little triangle above it for now, then below it:
// timed events (yellow today, magenta tomorrow) and forecast rain (cyan).
const drawAxis = function (nowMs, nowX, list) {
  g.setColor(0, 0.5, 1);
  g.fillRect(0, horizon, w - 1, horizon + 1);

  const now = new Date(nowMs);
  const midMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  for (const a of list) {
    if (!a.allDay) drawSpan(a.start, a.end, nowMs, midMs, horizon + 3, YELLOW, MAGENTA);
  }
  if (weather) {
    for (const r of weather.rain) drawSpan(r[0], r[1], nowMs, midMs, horizon + 6, CYAN, CYAN);
  }

  g.setColor(1, 1, 1);
  const tri = [nowX, horizon - 2, nowX - 4, horizon - 9, nowX + 4, horizon - 9];
  g.fillPoly(tri);
  g.setColor(0, 0, 0);
  g.drawPoly(tri, true);
};

const drawGlow = function (x, y) {
  g.setColor(0.5, 0.5, 0);
  g.fillCircle(x, y, rUp + 6);
};

const drawBall = function (x, y, up) {
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
};

const YELLOW = [1, 1, 0];
const CYAN = [0, 1, 1];
const MAGENTA = [1, 0, 1];

// Coloured prefix for an event:
//   "til 14:00" if it's on now, "in 25m" if it's within the hour,
//   "+08:00" if it's tomorrow, otherwise just the start time.
const apptPrefix = function (a, nowMs) {
  const when = new Date(a.start);
  const tomorrow = a.start > nowMs && when.getDate() !== new Date(nowMs).getDate();
  if (a.allDay) return tomorrow ? [['+', CYAN]] : [];
  if (a.start <= nowMs) return [['til ' + formatTime(new Date(a.end)), YELLOW]];
  const mins = Math.round((a.start - nowMs) / 60000);
  if (mins < 60) return [[mins < 1 ? 'now' : 'in ' + mins + 'm', YELLOW]];
  return tomorrow ? [['+', CYAN], [formatTime(when), YELLOW]] : [[formatTime(when), YELLOW]];
};

// Draw an event: its prefix and title, wrapped to at most maxLines lines and
// left-aligned. If atBottom, y is its bottom edge and a single line is
// centred. Returns the height.
const drawEvent = function (a, nowMs, y, maxLines, atBottom) {
  const prefix = apptPrefix(a, nowMs);
  const prefixStr = prefix.map(p => p[0]).join('');
  const maxW = w - 8;
  let lines = g.wrapString((prefixStr ? prefixStr + ' ' : '') + a.msg, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length && g.stringWidth(last + '...') > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trim() + '...';
  }

  const lh = g.getFontHeight();
  const x = (atBottom && lines.length === 1) ? ((w - g.stringWidth(lines[0])) / 2) | 0 : 4;
  if (atBottom) y -= lines.length * lh;

  for (let i = 0; i < lines.length; i++) drawOutlined(lines[i], x, y + i * lh);
  // recolour the prefix on the first line by drawing over it
  if (prefixStr && lines[0].indexOf(prefixStr) === 0) {
    let px = x;
    for (const p of prefix) {
      g.setColor.apply(g, p[1]);
      g.drawString(p[0], px, y);
      px += g.stringWidth(p[0]);
    }
  }
  return lines.length * lh;
};

const drawClock = function (now) {
  g.setFontAlign(1, -1, 0);
  g.setFont('Vector', 34);
  drawOutlined(formatTime(now), w - 3, 27);

  g.setFontAlign(-1, -1, 0);
  g.setFont('Vector', 18);
  drawOutlined('' + now.getDate() + '/' + (now.getMonth() + 1), 4, 28);

  // Next sunrise/sunset, under the date on the left.
  const nowMs = now.getTime();
  let nextSun, up;
  if (nowMs < sunrise.getTime()) {
    nextSun = sunrise; up = true;
  } else if (nowMs < sunset.getTime()) {
    nextSun = sunset; up = false;
  } else {
    nextSun = sunTime(new Date(nowMs + 86400000), true, 90.8333);
    up = true;
  }

  const ty = 48; // y position for sun time line
  const ax = 4;  // arrow left x
  const aw = 10; // arrow width
  const ah = 11; // arrow height
  const arrow = up ? [ax + aw / 2, ty + 1, ax, ty + ah + 1, ax + aw, ty + ah + 1]
                   : [ax, ty + 2, ax + aw, ty + 2, ax + aw / 2, ty + ah + 2];
  g.setColor(0, 0, 0);
  g.drawPoly(arrow, true);
  g.setColor(1, 1, 0);
  g.fillPoly(arrow);
  if (!isNaN(nextSun.getTime()))
    drawOutlined(formatTime(nextSun), ax + aw + 3, ty);
};

/* Tapping shows a list of everything coming up in the next day, until
 * tapped again or LIST_MS passes. */
const LIST_MS = 10000;
let listTimeout;

const drawList = function (nowMs) {
  g.setColor(0, 0, 0);
  g.fillRect(0, skyTop, w - 1, h - 1);
  g.setFont('Vector', 16);
  g.setFontAlign(-1, -1, 0);
  const list = upcoming(nowMs);
  if (!list.length) {
    g.setFontAlign(0, 0, 0);
    drawOutlined('Nothing today', w / 2, (skyTop + h) / 2);
    return;
  }
  let y = skyTop + 4;
  for (const a of list) {
    if (y > h - g.getFontHeight()) break;
    y += drawEvent(a, nowMs, y, 2, false) + 4;
  }
};

const renderScreen = function () {
  const now = new Date();
  const nowMs = now.getTime();
  if (listTimeout) return drawList(nowMs);

  const t = hourOf(now);
  const nowX = xfromTime(t);
  const nowY = ypos(nowX);
  const up = nowY < horizon;
  const sky = skyForTime(t);
  const sc = weather && weather.scene;
  const list = upcoming(nowMs);

  g.reset();
  drawSky(sky);
  drawSea();

  // everything in the sky gets clipped to the horizon
  g.setClipRect(0, skyTop, w - 1, horizon - 1);
  // can't see the stars through heavy cloud
  if (!sc || (sc.clouds < 3 && !sc.precip)) drawStars(sky.stars);
  if (up) drawGlow(nowX, nowY);
  let moonX, moonUp = false;
  if (settings.moon) {
    const phase = moonPhase(nowMs);
    moonX = xfromTime(mod(t - phase * 24, 24));
    const moonY = ypos(moonX);
    moonUp = moonY + rMoon < horizon && phase > 0.04 && phase < 0.96;
    if (moonUp) drawMoon(moonX, Math.round(moonY), phase, sky.night);
  }
  drawWeather(sky);
  g.setClipRect(0, 0, w - 1, h - 1);

  if (up) drawReflection(nowX, [1, 1, 0.3], rUp);
  else if (moonUp && sky.night) drawReflection(moonX, [0.8, 0.8, 0.8], rMoon - 1);

  drawPath(nowX);
  drawAxis(nowMs, nowX, list);
  drawBall(nowX, nowY, up);

  const next = nextAppointment(list);
  if (next) {
    g.setFont('Vector', 18);
    g.setFontAlign(-1, -1, 0);
    drawEvent(next, nowMs, h - 1, 2, true);
  }
  drawClock(now);
};

/* ---------------------------------------------------------------------------
 *  Frame loop. We tick once a minute, aligned to the top of the minute, and
 *  we PAUSE entirely while the screen is off (see the lcdPower handler) so we
 *  aren't redrawing / re-reading storage for a display nobody's looking at.
 * ------------------------------------------------------------------------- */
let drawTimeout;

const queueNext = function () {
  if (drawTimeout) clearTimeout(drawTimeout);
  drawTimeout = setTimeout(function () {
    drawTimeout = undefined;
    tick();
  }, 60000 - (Date.now() % 60000));
};

const tick = function () {
  const now = Date.now();
  if (Math.floor(now / 86400000) !== sunDay) computeSun(); // day rollover
  if (scanAt === 0 || (now - scanAt) > RESCAN_MS) {
    appts = scanAppointments();
    weather = loadWeather();
    scanAt = now;
  }
  renderScreen();
  queueNext();
};

const onLcdPower = function (on) {
  if (on) {
    tick();
  } else if (drawTimeout) {
    clearTimeout(drawTimeout);
    drawTimeout = undefined;
  }
};

const closeList = function () {
  if (listTimeout) clearTimeout(listTimeout);
  listTimeout = undefined;
};

const onTouch = function () {
  if (listTimeout) {
    closeList();
  } else {
    listTimeout = setTimeout(function () {
      listTimeout = undefined;
      renderScreen();
    }, LIST_MS);
  }
  renderScreen();
};

Bangle.setUI({
  mode: 'clock',
  touch: onTouch,
  remove: function () {
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = undefined;
    closeList();
    Bangle.removeListener('lcdPower', onLcdPower);
    g.reset();
  }
});
Bangle.on('lcdPower', onLcdPower);
Bangle.loadWidgets();

g.setBgColor(0, 0, 0);
g.clearRect(0, skyTop, w - 1, h - 1);
Bangle.drawWidgets();
computeSun();
tick();
}
