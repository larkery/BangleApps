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

function loadNextAppointment () {
  try {
    const sched = require('sched');
    const now = Date.now();
    const alarms = sched.getAlarms().filter(a => a.on && !a.hidden);
    let best = null;
    let bestT = Infinity;
    for (const a of alarms) {
      const t = sched.getTimeToAlarm(a);
      if (t && t > 0 && t < bestT) {
        bestT = t;
        best = a;
      }
    }
    if (!best) return null;
    const when = new Date(now + bestT);
    return {
      msg: best.msg || best.appt || 'Appt',
      when: when
    };
  } catch (e) {
    return null;
  }
}

let nextAppt = loadNextAppointment();


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
  time = Math.mod(time, 24);

  const midnight = new Date(0);
  // midnight.setUTCFullYear(this.getUTCFullYear());
  // midnight.setUTCMonth(this.getUTCMonth());
  // midnight.setUTCDate(this.getUTCDate());

  const milli = midnight.getTime() + (time * 60 * 60 * 1000);

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

const sunrise = new Date().sunrise(lat, lon);
const sunset = new Date().sunset(lat, lon);

const w = g.getWidth();
const h = g.getHeight();
const oy = h / 1.7;

let sunRiseX = 0;
let sunSetX = 0;
const sinStep = 13;

let pos = 0;
const r = 10;

function formatAsTime (hour, minute) {
  return '' + ((hour < 10) ? '0' : '') + (0 | hour) +
         ':' + ((minute < 10) ? '0' : '') + (0 | minute);
}

function drawSinuses () {
  let x = 0;

  g.setColor(1, 1, 1);
  let y = ypos(x);
  while (x < w) {
    const y2 = ypos(x + sinStep);
    g.drawLine(x, y, x + sinStep, y2);
    y = y2;
    x += sinStep; // no need to draw all steps
  }

  // sea level line
  const sl0 = seaLevel(sunrise.getHours());
  const sl1 = seaLevel(sunset.getHours());
  sunRiseX = xfromTime(sunrise.getHours() + sunrise.getMinutes() / 60);
  sunSetX = xfromTime(sunset.getHours() + sunset.getMinutes() / 60);
  g.setColor(0, 0.5, 1);
  g.drawLine(0, sl0, w, sl1);
  g.drawLine(0, sl0 + 1, w, sl1 + 1);
}

function drawTimes () {
  g.setColor(1, 1, 1);
  g.setFont('6x8', 2);
  g.drawString(formatAsTime(sunrise.getHours(), sunrise.getMinutes()), 10, h - 20);
  g.drawString(formatAsTime(sunset.getHours(), sunset.getMinutes()), w - 60, h - 20);
}

function drawGlow () {
  const now = new Date();
  pos = xfromTime(now.getHours() + now.getMinutes() / 60);
  const x = pos;
  const y = ypos(x);

  // compute horizon at this x (interpolate between sl0 and sl1)
  const sl0 = seaLevel(sunrise.getHours());
  const sl1 = seaLevel(sunset.getHours());
  const horizonY = sl0 + (sl1 - sl0) * x / w;

  // clip drawing so halo doesn't extend below the horizon line
  g.setClipRect(0, 0, w - 1, Math.max(0, Math.floor(horizonY)));

  g.setColor(0.2, 0.2, 0);
  // wide glow
  if (x > sunRiseX && x < sunSetX) {
    g.fillCircle(x, y, r + 20);
    g.setColor(0.5, 0.5, 0);
  }
  // smol glow
  g.fillCircle(x, y, r + 8);

  // reset clip
  g.setClipRect(0, 0, w - 1, h - 1);
}


function seaLevel (hour) {
  return ypos(xfromTime(hour));
}

function ypos (x) {
  return oy + (32 * Math.sin(((x + sunRiseX - 12) / w) * 6.28 ));
}

function xfromTime (t) {
  return (w / 24) * t;
}

function drawBall () {
  const now = new Date();
  pos = xfromTime(now.getHours() + now.getMinutes() / 60);
  const x = pos;
  const y = ypos(x);

  if (x > sunRiseX && x < sunSetX) {
    g.setColor(1, 1, 1);
  } else {
    g.setColor(0.5, 0.5, 0);
  }
  g.fillCircle(x, y, r);
  g.setColor(1, 1, 0);
  g.drawCircle(x, y, r);
}

function drawClock () {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();

  g.setFont('Vector', 30);
  g.setColor(1, 1, 1);
  g.drawString(formatAsTime(hours, mins), w / 1.9, 32);
  // day-month
  const mo = now.getMonth() + 1;
  const da = now.getDate();
  g.setFont('6x8', 2);
  g.drawString('' + da + '/' + mo, 5, 30);
}

// ---- sky colour + stars additions ----
const skyTop = 30;
const TWILIGHT = 0.9;
const GOLDEN = 1.2;

const riseT = sunrise.getHours() + sunrise.getMinutes() / 60;
const setT = sunset.getHours() + sunset.getMinutes() / 60;

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

function horizonYs () {
  return [seaLevel(sunrise.getHours()), seaLevel(sunset.getHours())];
}

function drawSky () {
  const now = new Date();
  const t = now.getHours() + now.getMinutes() / 60;
  const sky = skyForTime(t);
  const hy = horizonYs();
  const sl0 = hy[0], sl1 = hy[1];

  if (sky.bands) {
    const hiHorizon = Math.min(sl0, sl1);
    const n = sky.bands.length;
    const bh = (hiHorizon - skyTop) / n;
    for (let k = 0; k < n; k++) {
      const c = sky.bands[k];
      g.setColor(c[0], c[1], c[2]);
      g.fillRect(0, skyTop + k * bh, w, skyTop + (k + 1) * bh);
    }
    const last = sky.bands[n - 1];
    g.setColor(last[0], last[1], last[2]);
    g.fillRect(0, hiHorizon, w, Math.max(sl0, sl1) + 2);
  }

  g.setColor(0, 0, 0);
  g.fillPoly([0, sl0, w, sl1, w, h, 0, h]);

  return sky.stars;
}

function drawStars (level) {
  if (level <= 0) return;
  const hy = horizonYs();
  const sl0 = hy[0], sl1 = hy[1];
  for (const s of stars) {
    if (s.thr > level) continue;
    const horizon = sl0 + (sl1 - sl0) * s.x / w;
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
// ---- end additions ----

function renderScreen () {
  g.setColor(0, 0, 0);
  g.fillRect(0, 30, w, h);
  g.setFontAlign(-1, -1, 0);

  const starLevel = drawSky();
  drawStars(starLevel);

  Bangle.drawWidgets();

  drawGlow();
  drawSinuses();
  drawTimes();
  drawClock();
  drawBall();
}

function renderAndQueue() {
  setTimeout(renderAndQueue, 60000 - (Date.now() % 60000));
  renderScreen();
}

function main () {
  sunRiseX = xfromTime(sunrise.getHours() + sunrise.getMinutes() / 60);
  sunSetX = xfromTime(sunset.getHours() + sunset.getMinutes() / 60);

  g.setBgColor(0, 0, 0);
  g.clear();
  renderAndQueue();
}

main();
