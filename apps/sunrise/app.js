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

let frames = 0; // amount of pending frames to render (0 if none)
// set to 1 because pos 0 is displayed as 0-1:59
let curPos = 1; // x position of the sun
let realPos = 0; // x position of the sun depending on currentime


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
  /*
  g.setColor(0, 0, 1);
  g.drawLine(0, sl0 + 1, w, sl1 + 1);
  g.setColor(0, 0, 0.5);
  g.drawLine(0, sl0 + 2, w, sl1 + 2);
  */
}

function drawTimes () {
  g.setColor(1, 1, 1);
  g.setFont('6x8', 2);
  g.drawString(formatAsTime(sunrise.getHours(), sunrise.getMinutes()), 10, h - 20);
  g.drawString(formatAsTime(sunset.getHours(), sunset.getMinutes()), w - 60, h - 20);
}

function drawGlow () {
  const now = new Date();
  if (frames < 1 && realTime) {
    pos = xfromTime(now.getHours() + now.getMinutes() / 60);
  }
  const x = pos;
  const y = ypos(x);

  g.setColor(0.2, 0.2, 0);
  // wide glow
  if (x > sunRiseX && x < sunSetX) {
    g.fillCircle(x, y, r + 20);
    g.setColor(0.5, 0.5, 0);
  }
  // smol glow
  g.fillCircle(x, y, r + 8);
}

function seaLevel (hour) {
  // hour goes from 0 to 24
  // to get the X we divide the screen in 24
  return ypos(xfromTime(hour));
}

function ypos (x) {
  // offset, resulting in zenith being at the correct time
  return oy + (32 * Math.sin(((x + sunRiseX - 12) / w) * 6.28 ));
}

function xfromTime (t) {
  return (w / 24) * t;
}

function drawBall () {
  const now = new Date();
  if (frames < 1 && realTime) {
    pos = xfromTime(now.getHours() + now.getMinutes() / 60);
  }
  const x = pos;
  const y = ypos(x);

  // glow
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

  let hours = 0.0;
  let mins = 0.0;
  if (realTime) {
    hours = now.getHours();
    mins = now.getMinutes();
  } else {
    hours = 24 * (pos / w);
    const nexth = 24 * 60 * (pos / w);
    mins = 59 - ((24 * 60) - nexth) % 60;

    // this prevents the displayed time to jump from 11:50 to 12:59 to 12:07
    if (mins == 59) {
      hours--;
    }
  }

  g.setFont('Vector', 30);
  g.setColor(realTime, 1, 1);
  g.drawString(formatAsTime(hours, mins), w / 1.9, 32);
  // day-month
    const mo = now.getMonth() + 1;
    const da = now.getDate();
    g.setFont('6x8', 2);
    g.drawString('' + da + '/' + mo, 5, 30);
  
}

// ---- sky colour + stars additions ----
const skyTop = 30;
const TWILIGHT = 0.9; // hours of twilight either side of sunrise/sunset
const GOLDEN = 1.2;   // hours of warm "golden" sky after sunrise / before sunset

const riseT = sunrise.getHours() + sunrise.getMinutes() / 60;
const setT = sunset.getHours() + sunset.getMinutes() / 60;

// pre-generate a stable star field so stars don't jump around every redraw
const stars = [];
(function () {
  for (let i = 0; i < 45; i++) {
    stars.push({
      x: (Math.random() * w) | 0,
      y: (skyTop + Math.random() * (oy - skyTop)) | 0,
      thr: Math.random(),                             // fades in as night deepens
      big: Math.random() < 0.15,                      // a few brighter stars
      c: (Math.random() < 0.85) ? [1, 1, 1] : [0, 1, 1] // mostly white, some cyan
    });
  }
})();

// choose sky bands (top -> horizon) and how strongly stars show, for a given time
function skyForTime (t) {
  // deep night
  if (t < riseT - TWILIGHT || t > setT + TWILIGHT)
    return { bands: null, stars: 1 };
  // dawn twilight
  if (t < riseT)
    return { bands: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], stars: (riseT - t) / TWILIGHT };
  // just after sunrise - warm glow
  if (t < riseT + GOLDEN)
    return { bands: [[0, 0, 1], [0, 1, 1], [1, 1, 0]], stars: 0 };
  // dusk twilight
  if (t > setT)
    return { bands: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], stars: (t - setT) / TWILIGHT };
  // just before sunset - warm glow
  if (t > setT - GOLDEN)
    return { bands: [[0, 0, 1], [1, 0, 1], [1, 1, 0]], stars: 0 };
  // daytime: higher sun = deeper blue up top, lighter cyan near the horizon
  const a = Math.sin(Math.PI * (t - riseT) / (setT - riseT)); // 0 at horizon, 1 at noon
  if (a > 0.6) return { bands: [[0, 0, 1], [0, 0, 1], [0, 1, 1]], stars: 0 };
  return { bands: [[0, 0, 1], [0, 1, 1], [0, 1, 1]], stars: 0 };
}

// y of the (tilted) horizon at the left and right edges - matches drawSinuses()
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
    const hiHorizon = Math.min(sl0, sl1); // highest point of the horizon line
    const n = sky.bands.length;
    const bh = (hiHorizon - skyTop) / n;
    for (let k = 0; k < n; k++) {
      const c = sky.bands[k];
      g.setColor(c[0], c[1], c[2]);
      g.fillRect(0, skyTop + k * bh, w, skyTop + (k + 1) * bh);
    }
    // let the warmest band hug the horizon between its high and low points
    const last = sky.bands[n - 1];
    g.setColor(last[0], last[1], last[2]);
    g.fillRect(0, hiHorizon, w, Math.max(sl0, sl1) + 2);
  }

  // sea/ground below the horizon stays black (also crisps up the horizon edge)
  g.setColor(0, 0, 0);
  g.fillPoly([0, sl0, w, sl1, w, h, 0, h]);

  return sky.stars;
}

function drawStars (level) {
  if (level <= 0) return;
  const hy = horizonYs();
  const sl0 = hy[0], sl1 = hy[1];
  for (const s of stars) {
    if (s.thr > level) continue;                 // fade in as it gets darker
    const horizon = sl0 + (sl1 - sl0) * s.x / w;
    if (s.y > horizon - 2) continue;             // keep them up in the sky
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
  const now = new Date();
  g.setColor(0, 0, 0);
  g.fillRect(0, 30, w, h);
  realPos = xfromTime(now.getHours() + now.getMinutes() / 60);
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

Bangle.on('lock', () => {
  renderScreen();
});

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
  initialAnimation();
}

main();
