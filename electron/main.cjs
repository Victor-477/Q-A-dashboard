const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');
const path = require('path');

app.setName('Q&A Dashboard');
app.setPath('userData', path.join(app.getPath('temp'), 'qa-dashboard-electron'));
Menu.setApplicationMenu(null);

let mainWindow;
let siteProcess = null;
let serviceState = createInitialState();

function createInitialState() {
  return {
    status: 'stopped',
    pid: null,
    config: null,
    urls: [],
    port: null,
    startedAt: null,
    exitCode: null,
    logs: []
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1024,
    minHeight: 680,
    title: 'Q&A Dashboard',
    backgroundColor: '#f9fafb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'dashboard.html'));
}

function sendState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service:state', serviceState);
  }
}

function pushLog(message, level = 'info') {
  const text = String(message).trim();
  if (!text) return;

  serviceState.logs = [
    ...serviceState.logs,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: new Date().toISOString(),
      level,
      message: text
    }
  ].slice(-250);

  sendState();
}

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter(details => details.family === 'IPv4' && !details.internal)
    .map(details => details.address);
}

function normalizeConfig(config = {}) {
  const port = Number(config.port || 3000);
  const safePort = Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
  const defaultMode = app.isPackaged ? 'production' : 'development';
  const requestedMode = config.mode === 'production' ? 'production' : 'development';

  return {
    appName: String(config.appName || 'Q&A Dashboard').trim() || 'Q&A Dashboard',
    port: safePort,
    host: String(config.host || '0.0.0.0').trim() || '0.0.0.0',
    teacherPasswords: String(config.teacherPasswords || 'professor123').trim() || 'professor123',
    workingDirectory: String(config.workingDirectory || app.getAppPath()).trim() || app.getAppPath(),
    mode: app.isPackaged ? defaultMode : requestedMode
  };
}

function buildServerCommand(config) {
  if (config.mode === 'production') {
    if (app.isPackaged) {
      const unpackedBase = path.join(process.resourcesPath, 'app.asar.unpacked');
      const serverPath = path.join(unpackedBase, 'dist', 'server.cjs');

      return {
        command: process.execPath,
        args: [serverPath],
        env: { ELECTRON_RUN_AS_NODE: '1' },
        cwd: unpackedBase
      };
    }

    const serverPath = path.join(config.workingDirectory, 'dist', 'server.cjs');
    return {
      command: 'node',
      args: [serverPath],
      env: {},
      cwd: config.workingDirectory
    };
  }

  return {
    command: 'node',
    args: [path.join(config.workingDirectory, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server.ts'],
    env: {},
    cwd: config.workingDirectory
  };
}

function parseRuntimeOutput(line) {
  const urlMatches = [...line.matchAll(/https?:\/\/[^\s]+/g)].map(match => match[0]);

  if (urlMatches.length > 0) {
    const nextUrls = new Set(serviceState.urls);
    urlMatches.forEach(url => nextUrls.add(url));
    serviceState.urls = [...nextUrls];

    const portMatch = urlMatches[0].match(/:(\d+)(?:\/|$)/);
    if (portMatch) {
      serviceState.port = Number(portMatch[1]);
    }
  }

  if (line.includes('Server running:')) {
    serviceState.status = 'running';
  }
}

function startService(configInput) {
  if (siteProcess) {
    return serviceState;
  }

  const config = normalizeConfig(configInput);
  const { command, args, env, cwd } = buildServerCommand(config);

  serviceState = {
    ...createInitialState(),
    status: 'starting',
    config,
    startedAt: new Date().toISOString(),
    urls: [
      `http://localhost:${config.port}`,
      ...getLanAddresses().map(address => `http://${address}:${config.port}`)
    ]
  };
  sendState();

  try {
    siteProcess = spawn(command, args, {
      cwd: cwd,
      env: {
        ...process.env,
        ...env,
        PORT: String(config.port),
        HOST: config.host,
        TEACHER_PASSWORDS: config.teacherPasswords,
        NODE_ENV: config.mode === 'production' ? 'production' : ''
      },
      windowsHide: true
    });
  } catch (error) {
    siteProcess = null;
    serviceState.status = 'stopped';
    serviceState.exitCode = 'spawn-error';
    pushLog(error.message, 'error');
    sendState();
    return serviceState;
  }

  serviceState.pid = siteProcess.pid;
  pushLog(`Starting ${config.appName} on ${config.host}:${config.port}.`);

  siteProcess.stdout.on('data', data => {
    String(data).split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      parseRuntimeOutput(line);
      pushLog(line, 'info');
    });
  });

  siteProcess.stderr.on('data', data => {
    String(data).split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      pushLog(line, line.toLowerCase().includes('port') ? 'warn' : 'error');
    });
  });

  siteProcess.on('error', error => {
    pushLog(error.message, 'error');
  });

  siteProcess.on('exit', code => {
    siteProcess = null;
    serviceState = {
      ...serviceState,
      status: 'stopped',
      pid: null,
      exitCode: code
    };
    pushLog(`Application stopped${code === null ? '' : ` with code ${code}`}.`, code ? 'warn' : 'info');
    sendState();
  });

  return serviceState;
}

function stopService() {
  if (!siteProcess) {
    serviceState.status = 'stopped';
    sendState();
    return serviceState;
  }

  serviceState.status = 'stopping';
  sendState();
  pushLog('Stopping application...');
  siteProcess.kill();
  return serviceState;
}

ipcMain.handle('service:get-state', () => serviceState);
ipcMain.handle('service:start', (_event, config) => startService(config));
ipcMain.handle('service:stop', () => stopService());
ipcMain.handle('service:open-url', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopService();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
