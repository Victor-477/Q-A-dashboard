// =============================================================================
// Q&A Dashboard — Main Controller
// =============================================================================
// Handles config management, service lifecycle, UI rendering, navigation,
// uptime tracking, analytics simulations, stats polling, and localization.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Constants & Defaults
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'qa-dashboard.config';
const LANG_STORAGE_KEY = 'qa-dashboard.lang';
const MAX_LOG_LINES = 80;

const DEFAULT_CONFIG = Object.freeze({
  appName: 'Q&A Dashboard',
  port: 3000,
  host: '0.0.0.0',
  teacherPasswords: 'professor123',
  workingDirectory: '',
  mode: 'development',
  enableAutoTranslate: true,
});

/** Map of status → hero button label translation key */
const HERO_BUTTON_KEYS = Object.freeze({
  stopped: 'Start Application',
  starting: 'Starting...',
  running: 'Stop Application',
  stopping: 'Stopping...',
});

// -----------------------------------------------------------------------------
// Translations Dictionary (en, pt, es, de, ja)
// -----------------------------------------------------------------------------
const TRANSLATIONS = {
  en: {
    'sidebar.system': 'SYSTEM',
    'sidebar.admin': 'Local Q&A Admin',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.configuration': 'Configuration',
    'sidebar.logs': 'Activity Logs',
    'sidebar.settings': 'System Settings',
    'sidebar.language': '🌐 Language',
    'page.dashboard': 'Dashboard',
    'page.configuration': 'Configuration',
    'page.logs': 'Activity Logs',
    'page.settings': 'System Settings',
    'hero.eyebrow': 'LOCAL RUNNER',
    'hero.title': 'Manage the Q&A application',
    'hero.desc': 'Configure the classroom site, start or stop it locally, and open the teacher or student view when running.',
    'hero.pid': 'PROCESS ID',
    'hero.port': 'ACTIVE PORT',
    'hero.uptime': 'UPTIME',
    'hero.btn.stopped': 'Start Application',
    'hero.btn.starting': 'Starting...',
    'hero.btn.running': 'Stop Application',
    'hero.btn.stopping': 'Stopping...',
    'config.title': 'Application Configuration',
    'config.name': 'Application Name',
    'config.port': 'Port',
    'config.host': 'Host',
    'config.autoTranslate': 'Automatic Translation',
    'config.enabled': 'Enabled',
    'config.disabled': 'Disabled',
    'config.password': 'Teacher Password',
    'config.directory': 'Working Directory',
    'config.browse': 'Browse',
    'config.discard': 'Discard',
    'config.save': 'Save Settings',
    'stats.title': 'Application Data & Stats',
    'stats.devices': 'Connected Devices',
    'stats.questions': 'Total Questions',
    'stats.answered': 'Answered Questions',
    'stats.pending': 'Pending Questions',
    'stats.url': 'Server URL',
    'quick.title': 'Quick Access',
    'quick.home': 'Home Page',
    'quick.student': 'Student Portal',
    'quick.teacher': 'Teacher Dashboard',
    'exports.title': 'DATA EXPORTS',
    'exports.pdf': 'PDF Log',
    'exports.xls': 'XLS Log',
    'analytics.title': 'Runtime Analytics',
    'analytics.cpu': 'CPU Usage',
    'analytics.memory': 'Memory',
    'analytics.db_stable': 'Database connection: Stable',
    'analytics.db_disconnected': 'Database connection: Disconnected',
    'logs.title': 'Runtime Activity Logs',
    'logs.subtitle': 'System Console output',
    'logs.clear': 'Clear Logs',
    'logs.waiting': 'Waiting for application activity...',
    'pref.title': 'System Preferences',
    'pref.autostart.title': 'Auto-Start Control Panel',
    'pref.autostart.desc': 'Launch the Q&A Dashboard automatically when logging in.',
    'pref.minimize.title': 'Minimize to Tray',
    'pref.minimize.desc': 'Keep the control panel active in the system tray when closing the window.',
    'pref.debug.title': 'Development Debug Output',
    'pref.debug.desc': 'Enable debug logs in the terminal interface and activate Chromium inspection tool.',
    'footer.text': 'Control Panel'
  },
  pt: {
    'sidebar.system': 'SISTEMA',
    'sidebar.admin': 'Painel Q&A Local',
    'sidebar.dashboard': 'Painel Principal',
    'sidebar.configuration': 'Configuração',
    'sidebar.logs': 'Logs de Atividade',
    'sidebar.settings': 'Ajustes do Sistema',
    'sidebar.language': '🌐 Idioma',
    'page.dashboard': 'Painel Principal',
    'page.configuration': 'Configurações do App',
    'page.logs': 'Logs de Atividade',
    'page.settings': 'Ajustes do Sistema',
    'hero.eyebrow': 'EXECUTOR LOCAL',
    'hero.title': 'Gerenciar o Aplicativo Q&A',
    'hero.desc': 'Configure o site da sala de aula, inicie ou pare localmente e abra a visualização do professor ou aluno quando estiver rodando.',
    'hero.pid': 'ID DO PROCESSO',
    'hero.port': 'PORTA ATIVA',
    'hero.uptime': 'TEMPO ATIVO',
    'hero.btn.stopped': 'Iniciar Servidor',
    'hero.btn.starting': 'Iniciando...',
    'hero.btn.running': 'Parar Servidor',
    'hero.btn.stopping': 'Parando...',
    'config.title': 'Configurações da Aplicação',
    'config.name': 'Nome do Aplicativo',
    'config.port': 'Porta',
    'config.host': 'Host / Endereço',
    'config.autoTranslate': 'Tradução Automática',
    'config.enabled': 'Habilitado',
    'config.disabled': 'Desabilitado',
    'config.password': 'Senha do Professor',
    'config.directory': 'Diretório de Trabalho',
    'config.browse': 'Buscar',
    'config.discard': 'Descartar',
    'config.save': 'Salvar Ajustes',
    'stats.title': 'Dados & Estatísticas do Servidor',
    'stats.devices': 'Dispositivos Conectados',
    'stats.questions': 'Total de Perguntas',
    'stats.answered': 'Perguntas Respondidas',
    'stats.pending': 'Perguntas Pendentes',
    'stats.url': 'URL de Acesso do Servidor',
    'quick.title': 'Acesso Rápido',
    'quick.home': 'Página Inicial',
    'quick.student': 'Portal do Aluno',
    'quick.teacher': 'Painel do Professor',
    'exports.title': 'EXPORTAR DADOS',
    'exports.pdf': 'Relatório PDF',
    'exports.xls': 'Planilha XLS',
    'analytics.title': 'Métricas do Sistema',
    'analytics.cpu': 'Uso de CPU',
    'analytics.memory': 'Uso de Memória',
    'analytics.db_stable': 'Conexão do Banco: Estável',
    'analytics.db_disconnected': 'Conexão do Banco: Desconectada',
    'logs.title': 'Logs de Atividade de Execução',
    'logs.subtitle': 'Saída do console do sistema',
    'logs.clear': 'Limpar Console',
    'logs.waiting': 'Aguardando atividade da aplicação...',
    'pref.title': 'Preferências do Sistema',
    'pref.autostart.title': 'Iniciar com o Sistema',
    'pref.autostart.desc': 'Inicia o Painel de Controle do Q&A automaticamente ao ligar o computador.',
    'pref.minimize.title': 'Minimizar para a Bandeja',
    'pref.minimize.desc': 'Mantém o painel ativo em segundo plano na barra de tarefas ao fechar a janela.',
    'pref.debug.title': 'Modo de Depuração (Debug)',
    'pref.debug.desc': 'Ativa logs de depuração avançados e ferramentas de inspeção do Chromium.',
    'footer.text': 'Painel de Controle'
  },
  es: {
    'sidebar.system': 'SISTEMA',
    'sidebar.admin': 'Panel Q&A Local',
    'sidebar.dashboard': 'Panel Principal',
    'sidebar.configuration': 'Configuración',
    'sidebar.logs': 'Registros de Actividad',
    'sidebar.settings': 'Ajustes del Sistema',
    'sidebar.language': '🌐 Idioma',
    'page.dashboard': 'Panel Principal',
    'page.configuration': 'Configuración',
    'page.logs': 'Registros de Actividad',
    'page.settings': 'Ajustes del Sistema',
    'hero.eyebrow': 'EJECUTOR LOCAL',
    'hero.title': 'Gestionar la Aplicación Q&A',
    'hero.desc': 'Configure el sitio de la clase, inicie o detenga localmente y abra la vista del profesor o alumno cuando esté en ejecución.',
    'hero.pid': 'ID DEL PROCESO',
    'hero.port': 'PUERTO ACTIVO',
    'hero.uptime': 'TIEMPO ACTIVO',
    'hero.btn.stopped': 'Iniciar Servidor',
    'hero.btn.starting': 'Iniciando...',
    'hero.btn.running': 'Detener Servidor',
    'hero.btn.stopping': 'Deteniendo...',
    'config.title': 'Configuración de la Aplicación',
    'config.name': 'Nombre de la Aplicación',
    'config.port': 'Puerto',
    'config.host': 'Host / Dirección',
    'config.autoTranslate': 'Traducción Automática',
    'config.enabled': 'Habilitado',
    'config.disabled': 'Deshabilitado',
    'config.password': 'Contraseña del Profesor',
    'config.directory': 'Directorio de Trabajo',
    'config.browse': 'Buscar',
    'config.discard': 'Descartar',
    'config.save': 'Guardar Ajustes',
    'stats.title': 'Datos y Estadísticas del Servidor',
    'stats.devices': 'Dispositivos Conectados',
    'stats.questions': 'Total de Preguntas',
    'stats.answered': 'Preguntas Respondidas',
    'stats.pending': 'Preguntas Pendientes',
    'stats.url': 'URL de Acceso del Servidor',
    'quick.title': 'Acceso Rápido',
    'quick.home': 'Página de Inicio',
    'quick.student': 'Portal del Estudiante',
    'quick.teacher': 'Panel del Profesor',
    'exports.title': 'EXPORTACIÓN DE DATOS',
    'exports.pdf': 'Reporte PDF',
    'exports.xls': 'Planilla XLS',
    'analytics.title': 'Métricas del Sistema',
    'analytics.cpu': 'Uso de CPU',
    'analytics.memory': 'Uso de Memoria',
    'analytics.db_stable': 'Conexión de Base: Estable',
    'analytics.db_disconnected': 'Conexión de Base: Desconectada',
    'logs.title': 'Registros de Actividad de Ejecución',
    'logs.subtitle': 'Salida de la consola del sistema',
    'logs.clear': 'Limpar Consola',
    'logs.waiting': 'Esperando actividad de la aplicación...',
    'pref.title': 'Preferencias del Sistema',
    'pref.autostart.title': 'Iniciar con el Sistema',
    'pref.autostart.desc': 'Inicia el Panel de Control de Q&A automáticamente al encender la computadora.',
    'pref.minimize.title': 'Minimizar a la Bandeja',
    'pref.minimize.desc': 'Mantiene el panel activo en segundo plano al cerrar la ventana.',
    'pref.debug.title': 'Modo de Depuración (Debug)',
    'pref.debug.desc': 'Activa registros de depuración avanzados y herramientas de inspección.',
    'footer.text': 'Panel de Control'
  },
  de: {
    'sidebar.system': 'SYSTEM',
    'sidebar.admin': 'Lokaler Q&A Admin',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.configuration': 'Konfiguration',
    'sidebar.logs': 'Aktivitätsprotokolle',
    'sidebar.settings': 'Systemeinstellungen',
    'sidebar.language': '🌐 Sprache',
    'page.dashboard': 'Dashboard',
    'page.configuration': 'Konfiguration',
    'page.logs': 'Aktivitätsprotokolle',
    'page.settings': 'Systemeinstellungen',
    'hero.eyebrow': 'LOKALER RUNNER',
    'hero.title': 'Q&A-Anwendung verwalten',
    'hero.desc': 'Konfigurieren Sie die Website des Klassenzimmers, starten oder stoppen Sie sie lokal und öffnen Sie die Lehrer- oder Schüleransicht.',
    'hero.pid': 'PROZESS ID',
    'hero.port': 'AKTIVER PORT',
    'hero.uptime': 'BETRIEBSZEIT',
    'hero.btn.stopped': 'Server Starten',
    'hero.btn.starting': 'Starten...',
    'hero.btn.running': 'Server Stoppen',
    'hero.btn.stopping': 'Stoppen...',
    'config.title': 'Anwendungskonfiguration',
    'config.name': 'Anwendungsname',
    'config.port': 'Port',
    'config.host': 'Host',
    'config.autoTranslate': 'Automatische Übersetzung',
    'config.enabled': 'Aktiviert',
    'config.disabled': 'Deaktiviert',
    'config.password': 'Lehrer-Passwort',
    'config.directory': 'Arbeitsverzeichnis',
    'config.browse': 'Durchsuchen',
    'config.discard': 'Verwerfen',
    'config.save': 'Einstellungen speichern',
    'stats.title': 'Anwendungsdaten & Statistiken',
    'stats.devices': 'Verbundene Geräte',
    'stats.questions': 'Fragen insgesamt',
    'stats.answered': 'Beantwortete Fragen',
    'stats.pending': 'Offene Fragen',
    'stats.url': 'Server-URL',
    'quick.title': 'Schnellzugriff',
    'quick.home': 'Startseite',
    'quick.student': 'Schülerportal',
    'quick.teacher': 'Lehrer-Dashboard',
    'exports.title': 'DATENEXPORT',
    'exports.pdf': 'PDF-Protokoll',
    'exports.xls': 'XLS-Protokoll',
    'analytics.title': 'Systemmetriken',
    'analytics.cpu': 'CPU-Auslastung',
    'analytics.memory': 'Speichernutzung',
    'analytics.db_stable': 'Datenbankverbindung: Stabil',
    'analytics.db_disconnected': 'Datenbankverbindung: Getrennt',
    'logs.title': 'Laufzeit-Aktivitätsprotokolle',
    'logs.subtitle': 'Konsolenausgabe des Systems',
    'logs.clear': 'Konsole löschen',
    'logs.waiting': 'Warten auf Anwendungsaktivität...',
    'pref.title': 'Systemeinstellungen',
    'pref.autostart.title': 'Automatischer Systemstart',
    'pref.autostart.desc': 'Q&A Dashboard beim Systemstart automatisch ausführen.',
    'pref.minimize.title': 'In System-Tray minimieren',
    'pref.minimize.desc': 'Kontrollpanel beim Schließen des Fensters im Hintergrund aktiv halten.',
    'pref.debug.title': 'Entwickler-Debug-Modus',
    'pref.debug.desc': 'Erweiterte Debug-Protokolle und Chromium-Inspektionstools aktivieren.',
    'footer.text': 'Kontrollpanel'
  },
  ja: {
    'sidebar.system': 'システム',
    'sidebar.admin': 'ローカルQ&A管理',
    'sidebar.dashboard': 'ダッシュボード',
    'sidebar.configuration': '設定',
    'sidebar.logs': '活動ログ',
    'sidebar.settings': 'システム設定',
    'sidebar.language': '🌐 言語',
    'page.dashboard': 'ダッシュボード',
    'page.configuration': 'アプリ設定',
    'page.logs': '活動ログ',
    'page.settings': 'システム設定',
    'hero.eyebrow': 'ローカルランナー',
    'hero.title': 'Q&Aアプリの管理',
    'hero.desc': '教室のサイトを設定し、ローカルで起動・停止します。実行時に教師または生徒 of 画面を開くことができます。',
    'hero.pid': 'プロセスID',
    'hero.port': '有効ポート',
    'hero.uptime': '稼働時間',
    'hero.btn.stopped': 'アプリ起動',
    'hero.btn.starting': '起動中...',
    'hero.btn.running': 'アプリ停止',
    'hero.btn.stopping': '停止中...',
    'config.title': 'アプリケーション設定',
    'config.name': 'アプリ名',
    'config.port': 'ポート',
    'config.host': 'ホスト',
    'config.autoTranslate': '自動翻訳',
    'config.enabled': '有効',
    'config.disabled': '無効',
    'config.password': '教師用パスワード',
    'config.directory': '作業ディレクトリ',
    'config.browse': '参照',
    'config.discard': '破棄',
    'config.save': '設定保存',
    'stats.title': 'サーバー情報 & 統計',
    'stats.devices': '接続デバイス数',
    'stats.questions': '質問合計',
    'stats.answered': '回答済みの質問',
    'stats.pending': '未回答の質問',
    'stats.url': 'サーバーURL',
    'quick.title': 'クイックアクセス',
    'quick.home': 'ホームページ',
    'quick.student': '生徒用ポータル',
    'quick.teacher': '教師用ダッシュボード',
    'exports.title': 'データエクスポート',
    'exports.pdf': 'PDF出力',
    'exports.xls': 'Excel出力',
    'analytics.title': 'システムメトリクス',
    'analytics.cpu': 'CPU使用率',
    'analytics.memory': 'メモリ使用量',
    'analytics.db_stable': 'DB接続状態: 正常',
    'analytics.db_disconnected': 'DB接続状態: 切断',
    'logs.title': 'システム実行ログ',
    'logs.subtitle': 'システムコンソール出力',
    'logs.clear': 'コンソール消去',
    'logs.waiting': 'アプリの起動を待機中...',
    'pref.title': 'システム設定',
    'pref.autostart.title': '自動起動設定',
    'pref.autostart.desc': 'ログイン時にQ&Aダッシュボードを自動的に起動します。',
    'pref.minimize.title': 'システムトレイに最小化',
    'pref.minimize.desc': 'ウィンドウを閉じた後もバックグラウンドでパネルを実行し続けます。',
    'pref.debug.title': '開発デバッグ出力',
    'pref.debug.desc': 'コンソールでのデバッグログの出力を有効にし、検証ツールを有効にします。',
    'footer.text': 'コントロールパネル'
  }
};

// -----------------------------------------------------------------------------
// 2. DOM Element References
// -----------------------------------------------------------------------------

/** Safely query the DOM — returns the element or null without throwing. */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Config form fields
const fields = {
  appName: $('#appName'),
  port: $('#port'),
  host: $('#host'),
  enableAutoTranslate: $('#enableAutoTranslate'),
  teacherPasswords: $('#teacherPasswords'),
  workingDirectory: $('#workingDirectory'),
  mode: $('#mode'),
};

// UI elements (grouped by area)
const el = {
  // Header / status indicators
  headerAction: $('#headerAction'),
  headerStatus: $('#headerStatus'),
  statusDot: $('#statusDot'),
  statusText: $('#statusText'),

  // Overview / hero card stats
  runtimeStatus: $('#runtimeStatus'),
  runtimePid: $('#runtimePid'),
  runtimePort: $('#runtimePort'),
  runtimeUptime: $('#runtimeUptime'),

  // Right sidebar extras
  runtimeUptimeDisplay: $('#runtimeUptimeDisplay'),
  connectionStatus: $('#connectionStatus'),

  // Quick-access & download buttons
  openHome: $('#openHome'),
  openStudent: $('#openStudent'),
  openTeacher: $('#openTeacher'),
  downloadLog: $('#downloadLog'),
  downloadPdf: $('#downloadPdf'),

  // Settings actions
  saveSettings: $('#saveSettings'),
  discardSettings: $('#discardSettings'),
  togglePassword: $('#togglePassword'),

  // Language Select
  langSelect: $('#langSelect'),
};

// Navigation items
const navItems = $$('.nav-item');

// -----------------------------------------------------------------------------
// 3. State Management
// -----------------------------------------------------------------------------

let currentState = null;
let hasUnsavedChanges = false;
let uptimeIntervalId = null;
let metricsIntervalId = null;
let statsIntervalId = null;
let currentLanguage = 'pt';

// -----------------------------------------------------------------------------
// 4. Config & Localization Management
// -----------------------------------------------------------------------------

/** Load config and language preference. */
function loadConfig() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  const config = saved
    ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
    : { ...DEFAULT_CONFIG };

  for (const [key, input] of Object.entries(fields)) {
    if (input) input.value = String(config[key] ?? '');
  }

  // Load language preference
  currentLanguage = window.localStorage.getItem(LANG_STORAGE_KEY) || 'pt';
  if (el.langSelect) {
    el.langSelect.value = currentLanguage;
  }
  translateUI(currentLanguage);

  hasUnsavedChanges = false;
}

/** Translate all DOM elements containing data-t attributes. */
function translateUI(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.pt;

  // Translate static text elements
  $$('[data-t]').forEach(elem => {
    const key = elem.dataset.t;
    if (dict[key]) {
      const textNode = [...elem.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) {
        textNode.textContent = dict[key];
      } else {
        const hasSvg = elem.querySelector('svg');
        if (hasSvg) {
          const span = elem.querySelector('span');
          if (span) span.textContent = dict[key];
        } else {
          elem.textContent = dict[key];
        }
      }
    }
  });

  // Translate button content in hero action
  if (currentState) {
    setButtonsForStatus(currentState.status ?? 'stopped');
  }

  // Update connection status label
  if (currentState) {
    renderConnectionStatus(currentState.status ?? 'stopped');
  }
}

/** Read the current form values into a config object. */
function readConfig() {
  return {
    appName: fields.appName?.value.trim() || DEFAULT_CONFIG.appName,
    port: Number(fields.port?.value || DEFAULT_CONFIG.port),
    host: fields.host?.value.trim() || DEFAULT_CONFIG.host,
    enableAutoTranslate: fields.enableAutoTranslate?.value === 'true',
    teacherPasswords:
      fields.teacherPasswords?.value.trim() || DEFAULT_CONFIG.teacherPasswords,
    workingDirectory: fields.workingDirectory?.value.trim() ?? '',
    mode: fields.mode?.value ?? DEFAULT_CONFIG.mode,
  };
}

/** Persist config to localStorage. */
function saveConfig() {
  const config = readConfig();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  hasUnsavedChanges = false;
  return config;
}

// -----------------------------------------------------------------------------
// 5. UI Rendering Functions
// -----------------------------------------------------------------------------

/** Resolve the best base URL from a state's url list. */
function getBaseUrl(state) {
  const local = state?.urls?.find((u) => u.includes('localhost'));
  return local ?? state?.urls?.[0] ?? null;
}

/** Append route path to base URL. */
function withPath(baseUrl, route) {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}${route}`;
}

/** Format duration into human-readable string. */
function formatUptime(totalSeconds) {
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s}s`;

  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

/** Set hero button label (localised) and enable/disable states. */
function setButtonsForStatus(status) {
  const isRunning = status === 'running';
  const isTransitioning = status === 'starting' || status === 'stopping';

  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.pt;

  if (el.headerAction) {
    const labelKey = `hero.btn.${status}`;
    const label = dict[labelKey] || HERO_BUTTON_KEYS[status] || HERO_BUTTON_KEYS.stopped;
    const span = el.headerAction.querySelector('span');
    if (span) {
      span.textContent = label;
    } else {
      el.headerAction.textContent = label;
    }

    // Dynamically insert/update SVG path to avoid duplicates
    let svgHtml = '';
    if (status === 'running') {
      // Stop (square) icon
      svgHtml = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>`;
    } else if (status === 'starting' || status === 'stopping') {
      // Loading spinner icon
      svgHtml = `<svg class="spinner-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite">
        <circle cx="12" cy="12" r="10" opacity="0.25" stroke="currentColor"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
      </svg>`;
    } else {
      // Play (triangle) icon
      svgHtml = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none">
        <polygon points="6,3 20,12 6,21" />
      </svg>`;
    }

    const existingSvg = el.headerAction.querySelector('svg');
    if (existingSvg) {
      existingSvg.outerHTML = svgHtml;
    } else {
      el.headerAction.insertAdjacentHTML('afterbegin', svgHtml);
    }

    el.headerAction.disabled = isTransitioning;
  }

  // Quick-access & download buttons
  const actionButtons = [
    el.openHome,
    el.openStudent,
    el.openTeacher,
    el.downloadLog,
    el.downloadPdf,
  ];
  for (const btn of actionButtons) {
    if (btn) btn.disabled = !isRunning;
  }
}

/** Render execution logs. */
function renderLogs(logs = []) {
  const logBox = $('#logBox');
  if (!logBox) return;

  if (logs.length === 0) {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.pt;
    logBox.textContent = dict['logs.waiting'] || 'Waiting for application activity...';
    return;
  }

  logBox.textContent = logs
    .slice(-MAX_LOG_LINES)
    .map((log) => {
      const time = new Date(log.time).toLocaleTimeString();
      return `[${time}] ${log.level.toUpperCase()} ${log.message}`;
    })
    .join('\n');

  logBox.scrollTop = logBox.scrollHeight;
}

/** Update DB status details. */
function renderConnectionStatus(status) {
  const isRunning = status === 'running';
  const dbDot = document.getElementById('dbStatusDot');
  const dbText = document.getElementById('dbStatusText');

  if (dbDot && dbText) {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.pt;
    if (isRunning) {
      dbDot.className = 'db-status-dot';
      dbText.textContent = dict['analytics.db_stable'] || 'Database connection: Stable';
    } else {
      dbDot.className = 'db-status-dot disconnected';
      dbText.textContent = dict['analytics.db_disconnected'] || 'Database connection: Disconnected';
    }
  }
}

/** Master state renderer. */
function renderState(state) {
  currentState = state;
  const status = state?.status ?? 'stopped';

  // Badge indicators
  if (el.headerStatus) el.headerStatus.className = `status-indicator ${status}`;
  if (el.statusDot) el.statusDot.className = `status-dot ${status}`;
  if (el.statusText) el.statusText.textContent = status.toUpperCase();

  // Stats boxes
  if (el.runtimeStatus) el.runtimeStatus.textContent = status.toUpperCase();
  if (el.runtimePid) el.runtimePid.textContent = state?.pid ?? '-';
  if (el.runtimePort) el.runtimePort.textContent = state?.port ?? '-';

  setButtonsForStatus(status);
  renderConnectionStatus(status);
  startMetricsSimulation(status);
  startStatsPolling(status);

  if (status === 'running') {
    startUptimeTimer(state?.startedAt);
  } else {
    stopUptimeTimer();
  }

  renderLogs(state?.logs ?? []);
}

// -----------------------------------------------------------------------------
// 6. Uptime, Metrics, and Stats Timers
// -----------------------------------------------------------------------------

function updateUptimeDisplay(startedAt) {
  if (!startedAt) return;

  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const formatted = formatUptime(Math.max(0, elapsed));

  if (el.runtimeUptime) el.runtimeUptime.textContent = formatted;
  if (el.runtimeUptimeDisplay) el.runtimeUptimeDisplay.textContent = formatted;
}

function startUptimeTimer(startedAt) {
  stopUptimeTimer();
  if (!startedAt) return;

  updateUptimeDisplay(startedAt);
  uptimeIntervalId = setInterval(() => {
    updateUptimeDisplay(startedAt);
  }, 1_000);
}

function stopUptimeTimer() {
  if (uptimeIntervalId) {
    clearInterval(uptimeIntervalId);
    uptimeIntervalId = null;
  }
  if (el.runtimeUptime) el.runtimeUptime.textContent = '0s';
  if (el.runtimeUptimeDisplay) el.runtimeUptimeDisplay.textContent = '0s';
}

function startMetricsSimulation(status) {
  stopMetricsSimulation();

  const isRunning = status === 'running';

  const updateMetrics = () => {
    const cpuVal = isRunning ? Math.floor(Math.random() * 15) + 8 : 0;
    const memoryUsage = isRunning ? Math.floor(Math.random() * 40) + 240 : 0;

    const cpuBar = document.getElementById('cpuBar');
    const cpuValue = document.getElementById('cpuValue');
    const memoryBar = document.getElementById('memoryBar');
    const memoryValue = document.getElementById('memoryValue');

    if (cpuBar) cpuBar.style.width = `${cpuVal}%`;
    if (cpuValue) cpuValue.textContent = `${cpuVal}%`;

    if (memoryBar) {
      if (isRunning) {
        memoryBar.style.width = `${(memoryUsage / 1024) * 100}%`;
        if (memoryValue) memoryValue.textContent = `${memoryUsage}MB / 1GB`;
      } else {
        memoryBar.style.width = `0%`;
        if (memoryValue) memoryValue.textContent = `0MB / 1GB`;
      }
    }
  };

  updateMetrics();
  metricsIntervalId = setInterval(updateMetrics, 2000);
}

function stopMetricsSimulation() {
  if (metricsIntervalId) {
    clearInterval(metricsIntervalId);
    metricsIntervalId = null;
  }
}

/** Fetch stats from express server REST API when running */
function startStatsPolling(status) {
  stopStatsPolling();

  const isRunning = status === 'running';
  const mainStatDevices = document.getElementById('mainStatDevices');
  const mainStatTotalQuestions = document.getElementById('mainStatTotalQuestions');
  const mainStatAnsweredQuestions = document.getElementById('mainStatAnsweredQuestions');
  const mainStatPendingQuestions = document.getElementById('mainStatPendingQuestions');
  const mainStatServerUrl = document.getElementById('mainStatServerUrl');

  const updateStats = async () => {
    if (!isRunning) {
      if (mainStatDevices) mainStatDevices.textContent = '0';
      if (mainStatTotalQuestions) mainStatTotalQuestions.textContent = '0';
      if (mainStatAnsweredQuestions) mainStatAnsweredQuestions.textContent = '0';
      if (mainStatPendingQuestions) mainStatPendingQuestions.textContent = '0';
      if (mainStatServerUrl) mainStatServerUrl.textContent = '-';
      return;
    }

    const baseUrl = getBaseUrl(currentState);
    if (!baseUrl) return;

    if (mainStatServerUrl) mainStatServerUrl.textContent = baseUrl;

    try {
      const response = await fetch(`${baseUrl}/api/stats`);
      if (response.ok) {
        const stats = await response.json();
        if (mainStatDevices) mainStatDevices.textContent = String(stats.connectedClients ?? 0);
        if (mainStatTotalQuestions) mainStatTotalQuestions.textContent = String(stats.totalQuestions ?? 0);
        if (mainStatAnsweredQuestions) mainStatAnsweredQuestions.textContent = String(stats.answeredQuestions ?? 0);
        if (mainStatPendingQuestions) mainStatPendingQuestions.textContent = String(stats.pendingQuestions ?? 0);
      }
    } catch (err) {
      console.warn('Failed to poll stats API:', err);
    }
  };

  updateStats();
  statsIntervalId = setInterval(updateStats, 2000);
}

function stopStatsPolling() {
  if (statsIntervalId) {
    clearInterval(statsIntervalId);
    statsIntervalId = null;
  }
}

// -----------------------------------------------------------------------------
// 7. Service Lifecycle Actions
// -----------------------------------------------------------------------------

async function saveAndMaybeRestart() {
  const config = saveConfig();
  const status = currentState?.status ?? 'stopped';

  if (status === 'starting' || status === 'running') {
    await window.qaDashboard.stop();
    setTimeout(async () => {
      await window.qaDashboard.start(config);
      renderState(await window.qaDashboard.getState());
    }, 700);
  } else {
    await window.qaDashboard.start(config);
    renderState(await window.qaDashboard.getState());
  }
}

async function toggleService() {
  const status = currentState?.status ?? 'stopped';

  if (hasUnsavedChanges) {
    await saveAndMaybeRestart();
  } else if (status === 'starting' || status === 'running') {
    await window.qaDashboard.stop();
    renderState(await window.qaDashboard.getState());
  } else {
    const config = readConfig();
    await window.qaDashboard.start(config);
    renderState(await window.qaDashboard.getState());
  }
}

// -----------------------------------------------------------------------------
// 8. Event Handlers
// -----------------------------------------------------------------------------

function openRoute(route) {
  const baseUrl = getBaseUrl(currentState);
  const url = withPath(baseUrl, route);
  if (url) {
    window.qaDashboard.openUrl(url);
  }
}

function bindEvents() {
  el.headerAction?.addEventListener('click', toggleService);

  el.openHome?.addEventListener('click', () => openRoute(''));
  el.openStudent?.addEventListener('click', () => openRoute('/student'));
  el.openTeacher?.addEventListener('click', () => openRoute('/teacher'));

  el.downloadLog?.addEventListener('click', async () => {
    try {
      el.downloadLog.disabled = true;
      const result = await window.qaDashboard.downloadLog();
      if (result?.success) {
        console.log('XLS Log saved successfully to:', result.filePath);
      }
    } catch (err) {
      console.error('Failed to export XLS log:', err);
    } finally {
      el.downloadLog.disabled = currentState?.status !== 'running';
    }
  });

  el.downloadPdf?.addEventListener('click', async () => {
    try {
      el.downloadPdf.disabled = true;
      const result = await window.qaDashboard.downloadPdf();
      if (result?.success) {
        console.log('PDF Log saved successfully to:', result.filePath);
      }
    } catch (err) {
      console.error('Failed to export PDF report:', err);
    } finally {
      el.downloadPdf.disabled = currentState?.status !== 'running';
    }
  });

  el.saveSettings?.addEventListener('click', saveAndMaybeRestart);

  el.discardSettings?.addEventListener('click', () => {
    loadConfig();
    setButtonsForStatus(currentState?.status ?? 'stopped');
  });

  el.togglePassword?.addEventListener('click', () => {
    const input = fields.teacherPasswords;
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    const btn = el.togglePassword;
    const eyeIcon = btn.querySelector('.icon-eye');
    const eyeOffIcon = btn.querySelector('.icon-eye-off');
    if (eyeIcon && eyeOffIcon) {
      eyeIcon.style.display = isHidden ? 'none' : 'block';
      eyeOffIcon.style.display = isHidden ? 'block' : 'none';
    }
  });

  // Language select change listener
  el.langSelect?.addEventListener('change', () => {
    const selectedLang = el.langSelect.value;
    window.localStorage.setItem(LANG_STORAGE_KEY, selectedLang);
    currentLanguage = selectedLang;
    translateUI(selectedLang);
  });

  // Field change tracking
  for (const input of Object.values(fields)) {
    if (!input) continue;

    const markDirty = () => {
      hasUnsavedChanges = true;
      setButtonsForStatus(currentState?.status ?? 'stopped');
    };

    input.addEventListener('input', markDirty);
    input.addEventListener('change', markDirty);
  }
}

// -----------------------------------------------------------------------------
// 9. Navigation
// -----------------------------------------------------------------------------

function initNavigation() {
  if (navItems.length === 0) return;

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      const target = item.dataset.section;
      if (!target) return;

      // Update active state on nav items
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      showSection(target);
    });
  });
}

function showSection(target) {
  const sections = $$('[data-section-content]');
  const pageTitle = $('#pageTitle');

  if (sections.length === 0) return;

  sections.forEach((section) => {
    const isVisible = section.dataset.sectionContent === target;
    section.style.display = isVisible ? 'block' : 'none';
  });

  // Update page title using translation keys
  if (pageTitle) {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.pt;
    const titleKey = `page.${target}`;
    pageTitle.textContent = dict[titleKey] || titleCase(target);
  }
}

// Helper to convert target to Title Case if key is missing
function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// -----------------------------------------------------------------------------
// 10. Initialisation
// -----------------------------------------------------------------------------

async function init() {
  loadConfig();
  bindEvents();
  initNavigation();

  window.qaDashboard.onState(renderState);
  renderState(await window.qaDashboard.getState());
}

init();
