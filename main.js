const { app, Tray, Menu, nativeImage } = require('electron');
const { writeFileSync, existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const ICON_SIZE = 18;
const FILENAME = 'zoomtrack.json';
const COMMAND = `ps -ef | grep zoom.us | grep MacOS/CptHost`;
const DEFAULT_TITLE = `✌️ No meetings today`;
const INTERVAL = 1000 * 60; // 1min
const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_MINUTE = 1000 * 60;

const getToday = () => {
  const currentDate = new Date();
  const day = currentDate.getDate().toString().padStart(2, '0');
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = currentDate.getFullYear();
  return `${day}-${month}-${year}`;
};

const getLogPath = () => {
  const logPath = join('/var', 'tmp', FILENAME);
  if (!existsSync(logPath)) {
    writeFileSync(logPath, JSON.stringify({}, null, 2));
  }
  return logPath;
};

const readJson = () => {
  try {
    const content = readFileSync(getLogPath(), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing JSON: ${error.message}`);
    return {};
  }
};

const writeJson = (stdout = '') => {
  const lines = stdout.split('\n');
  const parts = lines[0].split('-key');

  if (typeof parts[1] === 'string') {
    const meet = parts[1].trim();
    const json = readJson();

    if (json[meet]) {
      json[meet].time += INTERVAL;
    } else {
      json[meet] = {
        date: getToday(),
        start: (+new Date()),
        time: INTERVAL,
      };
    }
    writeFileSync(getLogPath(), JSON.stringify(json, null, 2));
  }
};

const formatMS = (milliseconds) => {
  const hours = Math.floor(milliseconds / MS_PER_HOUR);
  const minutes = Math.floor((milliseconds % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((milliseconds % MS_PER_MINUTE) / 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const updateTrayMenu = (app) => {
  let menuData = [{ label: DEFAULT_TITLE }];

  const json = readJson();
  const today = getToday();

  const todayMeets = Object.values(json).filter(k => k && k.date === today);

  if (todayMeets.length !== 0) {
    menuData = [];
    let totalToday = 0;

    todayMeets.forEach((meet, ki) => {
      totalToday += meet.time;
      const meetTime = formatMS(meet.time);
      const label = `Meeting #${ki + 1}: ${meetTime}`;

      menuData.push({ label });
    });

    menuData.unshift({ type: 'separator' });
    menuData.unshift({ label: `Today meetings: ${formatMS(totalToday)}` });
  }
  menuData.push({ type: 'separator' });
  menuData.push({
    label: 'Quit',
    click: () => { app.quit(); },
  });

  const newContextMenu = Menu.buildFromTemplate(menuData);
  tray.setContextMenu(newContextMenu);
};

app.on('ready', () => {
  const image = nativeImage.createFromPath(join(__dirname, "icon.png")).resize({ width: ICON_SIZE, height: ICON_SIZE });
  tray = new Tray(image);
  app.dock.hide();

  updateTrayMenu(app);

  setInterval(() => {
    try {
      const stdout = execSync(COMMAND).toString();
      writeJson(stdout);
      updateTrayMenu(app);
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
    }
  }, INTERVAL);
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
