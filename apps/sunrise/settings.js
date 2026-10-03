(function (back) {
  const FILE = 'sunrise.json';
  const settings = Object.assign({
    weather: true,
    calendar: true,
    moon: true
  }, require('Storage').readJSON(FILE, 1) || {});

  const toggle = function (key) {
    return {
      value: !!settings[key],
      onchange: v => {
        settings[key] = v;
        require('Storage').writeJSON(FILE, settings);
      }
    };
  };

  E.showMenu({
    '': { 'title': 'Sunrise' },
    '< Back': back,
    'Weather': toggle('weather'),
    'Calendar': toggle('calendar'),
    'Moon': toggle('moon')
  });
});
