const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');
const { randomUUID } = require('crypto');
const path = require('path');

app.setName('Q&A Dashboard');
app.setPath('userData', path.join(app.getPath('temp'), 'qa-dashboard-electron'));
Menu.setApplicationMenu(null);

let mainWindow;
let siteProcess = null;
let serviceState = createInitialState();

// Credential the dashboard uses to reach the protected export endpoints.
// Regenerated on every start and deliberately kept out of serviceState, which
// is broadcast to the renderer.
let exportToken = null;

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
    icon: path.join(__dirname, '../assets/icon.png'),
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

// Questions must outlive the process, so the database cannot live inside the
// portable executable's extraction folder (wiped on every launch) nor inside
// userData (pointed at temp above). %APPDATA%/qa-dashboard is stable.
function defaultDataDirectory() {
  return path.join(app.getPath('appData'), 'qa-dashboard', 'data');
}

function normalizeConfig(config = {}) {
  const port = Number(config.port || 3000);
  const safePort = Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
  const defaultMode = app.isPackaged ? 'production' : 'development';
  const requestedMode = config.mode === 'production' ? 'production' : 'development';

  return {
    dataDirectory: String(config.dataDirectory || defaultDataDirectory()).trim() || defaultDataDirectory(),
    appName: String(config.appName || 'Q&A Dashboard').trim() || 'Q&A Dashboard',
    port: safePort,
    host: String(config.host || '0.0.0.0').trim() || '0.0.0.0',
    teacherPasswords: String(config.teacherPasswords || '').trim(),
    workingDirectory: String(config.workingDirectory || app.getAppPath()).trim() || app.getAppPath(),
    mode: app.isPackaged ? defaultMode : requestedMode,
    // TLS is on unless explicitly disabled: without it the teacher password
    // crosses the classroom network in cleartext.
    enableTls: config.enableTls !== false,
    translateUrl: String(config.translateUrl || '').trim(),
    enableAutoTranslate: config.enableAutoTranslate !== false
  };
}

/** http or https, matching whether the spawned server will use TLS. */
function scheme(config) {
  return config.enableTls ? 'https' : 'http';
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

  exportToken = randomUUID();

  serviceState = {
    ...createInitialState(),
    status: 'starting',
    config,
    startedAt: new Date().toISOString(),
    urls: [
      `${scheme(config)}://localhost:${config.port}`,
      ...getLanAddresses().map(address => `${scheme(config)}://${address}:${config.port}`)
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
        QA_DATA_DIR: config.dataDirectory,
        QA_EXPORT_TOKEN: exportToken,
        // Empty means "let the server use the password stored in its database",
        // which it generates on first run. There is no password in the source.
        TEACHER_PASSWORDS: config.teacherPasswords || '',
        QA_TLS: config.enableTls ? 'auto' : 'off',
        // Empty disables translation entirely; no third party is contacted.
        QA_TRANSLATE_URL: config.translateUrl || '',
        ENABLE_AUTO_TRANSLATE: config.enableAutoTranslate ? 'true' : 'false',
        NODE_ENV: config.mode === 'production' ? 'production' : ''
      },
      windowsHide: true
    });
  } catch (error) {
    siteProcess = null;
    exportToken = null;
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
    exportToken = null;
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

/**
 * Fetches a path from the server this panel started.
 *
 * Written against the http/https modules rather than fetch() because the
 * server uses a self-signed certificate: rejectUnauthorized must be off for it,
 * and that is only acceptable because the request never leaves the loopback
 * interface and carries a token this process generated.
 */
function fetchLocal(requestPath) {
  return new Promise((resolve, reject) => {
    if (!serviceState.port) {
      reject(new Error('Server is not running'));
      return;
    }

    const secure = serviceState.config?.enableTls !== false;
    const transport = secure ? require('https') : require('http');

    const request = transport.request(
      {
        host: '127.0.0.1',
        port: serviceState.port,
        path: requestPath,
        method: 'GET',
        headers: { Authorization: `Bearer ${exportToken}` },
        rejectUnauthorized: false
      },
      response => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP error! status: ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );

    request.on('error', reject);
    request.end();
  });
}

/**
 * The panel's own pages fetch /api/stats from the server over TLS. Chromium
 * rejects the self-signed certificate by default, so trust it for loopback
 * only — never for anything else.
 */
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  const port = serviceState.port;
  const trusted = port
    && (url.startsWith(`https://localhost:${port}`) || url.startsWith(`https://127.0.0.1:${port}`));

  if (trusted) {
    event.preventDefault();
    callback(true);
    return;
  }
  callback(false);
});

ipcMain.handle('service:get-state', () => serviceState);
ipcMain.handle('service:start', (_event, config) => startService(config));
ipcMain.handle('service:stop', () => stopService());
ipcMain.handle('service:open-url', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});
ipcMain.handle('service:download-log', async (_event, options = {}) => {
  if (!serviceState.port || serviceState.status !== 'running') {
    throw new Error('Server is not running');
  }

  const scope = options.includeArchived ? '?all=1' : '';
  const defaultPath = path.join(app.getPath('downloads'), `qa-log-${Date.now()}.xlsx`);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Log de Perguntas',
    defaultPath: defaultPath,
    filters: [
      { name: 'Planilhas do Excel (*.xlsx)', extensions: ['xlsx'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false, reason: 'canceled' };
  }

  try {
    const buffer = await fetchLocal(`/api/questions/export${scope}`);
    
    const fs = require('fs');
    await fs.promises.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    pushLog(`Erro ao baixar log: ${error.message}`, 'error');
    throw error;
  }
});
ipcMain.handle('service:download-pdf', async (_event, options = {}) => {
  if (!serviceState.port || serviceState.status !== 'running') {
    throw new Error('Server is not running');
  }

  const scope = options.includeArchived ? '?all=1' : '';
  const defaultPath = path.join(app.getPath('downloads'), `qa-report-${Date.now()}.pdf`);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Relatório em PDF',
    defaultPath: defaultPath,
    filters: [
      { name: 'Documento PDF (*.pdf)', extensions: ['pdf'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false, reason: 'canceled' };
  }

  try {
    const buffer = await fetchLocal(`/api/questions/export/pdf${scope}`);
    
    const fs = require('fs');
    await fs.promises.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    pushLog(`Erro ao baixar PDF: ${error.message}`, 'error');
    throw error;
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
