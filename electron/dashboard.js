const defaultConfig = {
  appName: 'Q&A Dashboard',
  port: 3000,
  host: '0.0.0.0',
  teacherPasswords: 'professor123',
  workingDirectory: '',
  mode: 'development'
};

const fields = {
  appName: document.querySelector('#appName'),
  port: document.querySelector('#port'),
  host: document.querySelector('#host'),
  teacherPasswords: document.querySelector('#teacherPasswords'),
  workingDirectory: document.querySelector('#workingDirectory'),
  mode: document.querySelector('#mode')
};

const elements = {
  headerAction: document.querySelector('#headerAction'),
  openHome: document.querySelector('#openHome'),
  openStudent: document.querySelector('#openStudent'),
  openTeacher: document.querySelector('#openTeacher'),
  headerStatus: document.querySelector('#headerStatus'),
  statusDot: document.querySelector('#statusDot'),
  statusText: document.querySelector('#statusText'),
  runtimeStatus: document.querySelector('#runtimeStatus'),
  runtimePid: document.querySelector('#runtimePid'),
  runtimePort: document.querySelector('#runtimePort'),
  logBox: document.querySelector('#logBox')
};

let currentState = null;
let hasUnsavedChanges = false;

function loadConfig() {
  const saved = window.localStorage.getItem('qa-dashboard.config');
  const config = saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;

  Object.entries(fields).forEach(([key, input]) => {
    input.value = config[key] ?? '';
  });
}

function readConfig() {
  return {
    appName: fields.appName.value.trim() || defaultConfig.appName,
    port: Number(fields.port.value || defaultConfig.port),
    host: fields.host.value.trim() || defaultConfig.host,
    teacherPasswords: fields.teacherPasswords.value.trim() || defaultConfig.teacherPasswords,
    workingDirectory: fields.workingDirectory.value.trim(),
    mode: fields.mode.value
  };
}

function saveConfig() {
  const config = readConfig();
  window.localStorage.setItem('qa-dashboard.config', JSON.stringify(config));
  return config;
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function getBaseUrl(state) {
  const local = state?.urls?.find(url => url.includes('localhost'));
  return local || state?.urls?.[0] || null;
}

function withPath(baseUrl, route) {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}${route}`;
}

function setButtonsForStatus(status) {
  const isActive = ['starting', 'running', 'stopping'].includes(status);
  const isRunning = status === 'running';
  const isStopping = status === 'stopping';

  if (hasUnsavedChanges) {
    elements.headerAction.textContent = 'Save & Start';
  } else {
    elements.headerAction.textContent = isActive ? 'Stop Application' : 'Start Application';
  }

  elements.headerAction.disabled = isStopping;

  [
    elements.openHome,
    elements.openStudent,
    elements.openTeacher
  ].forEach(button => {
    button.disabled = !isRunning;
  });
}

function renderLogs(logs = []) {
  if (logs.length === 0) {
    elements.logBox.textContent = 'Waiting for application activity...';
    return;
  }

  elements.logBox.textContent = logs
    .slice(-80)
    .map(log => {
      const time = new Date(log.time).toLocaleTimeString();
      return `[${time}] ${log.level.toUpperCase()} ${log.message}`;
    })
    .join('\n');

  elements.logBox.scrollTop = elements.logBox.scrollHeight;
}

function renderState(state) {
  currentState = state;
  const status = state?.status || 'stopped';

  elements.headerStatus.className = `status-badge ${status}`;
  elements.statusDot.className = `status-dot ${status}`;
  elements.statusText.textContent = status;
  elements.runtimeStatus.textContent = titleCase(status);
  elements.runtimePid.textContent = state?.pid || '-';
  elements.runtimePort.textContent = state?.port || '-';

  setButtonsForStatus(status);
  renderLogs(state?.logs || []);
}

async function startInstance() {
  const config = saveConfig();
  await window.qaDashboard.start(config);
  hasUnsavedChanges = false;
  renderState(await window.qaDashboard.getState());
}

async function stopInstance() {
  await window.qaDashboard.stop();
  hasUnsavedChanges = false;
  renderState(await window.qaDashboard.getState());
}

function openRoute(route) {
  const baseUrl = getBaseUrl(currentState);
  const url = withPath(baseUrl, route);
  if (url) {
    window.qaDashboard.openUrl(url);
  }
}

function toggleInstance() {
  const status = currentState?.status || 'stopped';
  if (hasUnsavedChanges) {
    startOrRestartApplication();
  } else if (['starting', 'running'].includes(status)) {
    stopInstance();
  } else {
    startInstance();
  }
}

async function startOrRestartApplication() {
  const config = saveConfig();
  const status = currentState?.status || 'stopped';

  if (['starting', 'running'].includes(status)) {
    await window.qaDashboard.stop();
    window.setTimeout(async () => {
      await window.qaDashboard.start(config);
      hasUnsavedChanges = false;
      renderState(await window.qaDashboard.getState());
    }, 700);
    return;
  }

  await window.qaDashboard.start(config);
  hasUnsavedChanges = false;
  renderState(await window.qaDashboard.getState());
}

function bindEvents() {
  elements.headerAction.addEventListener('click', toggleInstance);

  elements.openHome.addEventListener('click', () => openRoute(''));
  elements.openStudent.addEventListener('click', () => openRoute('/student'));
  elements.openTeacher.addEventListener('click', () => openRoute('/teacher'));

  Object.values(fields).forEach(input => {
    input.addEventListener('input', () => {
      hasUnsavedChanges = true;
      setButtonsForStatus(currentState?.status || 'stopped');
    });
    input.addEventListener('change', () => {
      hasUnsavedChanges = true;
      setButtonsForStatus(currentState?.status || 'stopped');
    });
  });
}

async function init() {
  loadConfig();
  bindEvents();
  window.qaDashboard.onState(renderState);
  renderState(await window.qaDashboard.getState());
}

init();
