const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = process.env.PORT || 3456;
const APP_URL = `http://localhost:${PORT}`;

// Configure offline mode & local data directory
const userDataDir = app.getPath('userData');
process.env.OFFLINE_MODE = 'true';
process.env.USE_LOCAL_DB = 'true';
process.env.DATABASE_MODE = 'sqlite';
process.env.LOCAL_DATA_DIR = userDataDir;

/**
 * Check if the local server is reachable
 */
function checkServerReady(retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(APP_URL, (res) => {
        clearInterval(interval);
        resolve(true);
      });

      req.on('error', () => {
        if (attempts >= retries) {
          clearInterval(interval);
          reject(new Error('Server initialization timed out.'));
        }
      });

      req.end();
    }, delay);
  });
}

/**
 * Start the local Next.js server
 */
function startLocalServer() {
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  const projectRoot = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app');

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = isDev ? ['run', 'dev', '--', '-p', String(PORT)] : ['run', 'start', '--', '-p', String(PORT)];

  serverProcess = spawn(npmCmd, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      OFFLINE_MODE: 'true',
      USE_LOCAL_DB: 'true',
      DATABASE_MODE: 'sqlite'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to spawn local server:', err);
  });
}

/**
 * Create native browser window
 */
async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1024,
    minHeight: 700,
    title: 'سستمهالي - نظام نقاط البيع وإدارة المتاجر (النسخة المكتبية)',
    backgroundColor: '#0B1730',
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // Display initial loading placeholder while Next.js starts
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>سستمهالي - جاري التحميل</title>
      <style>
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #0B1730;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: #246BFD;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 24px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px 0; }
        p { font-size: 14px; color: #94A3B8; margin: 0; }
        .badge {
          display: inline-block;
          margin-top: 16px;
          padding: 4px 12px;
          background: rgba(36, 107, 253, 0.15);
          border: 1px solid rgba(36, 107, 253, 0.3);
          border-radius: 999px;
          font-size: 12px;
          color: #60A5FA;
        }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h1>سستمهالي (Sastmhaly)</h1>
      <p>جاري تشغيل النظام وقاعدة البيانات المحلية على جهازك...</p>
      <div class="badge">النسخة المكتبية الأوفلاين 100%</div>
    </body>
    </html>
  `)}`);

  try {
    await checkServerReady();
    mainWindow.loadURL(APP_URL);
  } catch (err) {
    console.error('Failed to load application:', err);
    mainWindow.loadURL(APP_URL);
  }

  // Application Menu
  const menuTemplate = [
    {
      label: 'الملف',
      submenu: [
        { label: 'إعادة التحميل', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'شاشة كاملة (وضع الكاشير)', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'خروج', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'نقطة البيع (POS)',
      submenu: [
        { label: 'فتح نقطة البيع', click: () => mainWindow.loadURL(`${APP_URL}/merchant/pos`) },
        { label: 'إدارة المنتجات', click: () => mainWindow.loadURL(`${APP_URL}/merchant/products`) },
        { label: 'سجل المبيعات', click: () => mainWindow.loadURL(`${APP_URL}/merchant/sales`) },
        { label: 'لوحة التحكم', click: () => mainWindow.loadURL(`${APP_URL}/merchant/dashboard`) }
      ]
    },
    {
      label: 'أدوات المطور',
      submenu: [
        { label: 'فتح شاشة الفحص (DevTools)', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('print-receipt', async (event, content, options = {}) => {
  if (!mainWindow) return { success: false, error: 'Window not found' };

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  });

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);

  return new Promise((resolve) => {
    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: options.silent !== undefined ? options.silent : true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
          pageSize: options.pageSize || { width: 80000, height: 297000 } // Default 80mm roll
        },
        (success, failureReason) => {
          printWindow.close();
          resolve({ success, error: failureReason });
        }
      );
    });
  });
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
    return !isFull;
  }
  return false;
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// App Lifecycle
app.whenReady().then(() => {
  startLocalServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {
      // ignore
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {
      // ignore
    }
  }
});

