const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const StorageManager = require('./storage');

let mainWindow = null;
let storage = null;

function createWindow() {
  const userDataPath = app.getPath('userData');
  storage = new StorageManager(userDataPath);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 650,
    icon: path.join(__dirname, 'icon.ico'),
    title: 'سستمهالي - نقاط البيع (Sastmhaly POS)',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('api:status', async () => storage.getStatus());
ipcMain.handle('api:setup', async (event, data) => storage.setupStore(data));
ipcMain.handle('api:get-settings', async () => storage.getSettings());
ipcMain.handle('api:save-settings', async (event, data) => storage.saveSettings(data));
ipcMain.handle('api:dashboard', async () => storage.getDashboard());
ipcMain.handle('api:products', async (event, { search, category_id }) => storage.getProducts(search, category_id));
ipcMain.handle('api:save-product', async (event, data) => storage.saveProduct(data));
ipcMain.handle('api:delete-product', async (event, id) => storage.deleteProduct(id));
ipcMain.handle('api:categories', async () => storage.getCategories());
ipcMain.handle('api:units', async () => storage.getUnits());
ipcMain.handle('api:inventory', async () => storage.getInventory());
ipcMain.handle('api:adjust-inventory', async (event, data) => storage.adjustInventory(data));
ipcMain.handle('api:sales', async () => storage.getSales());
ipcMain.handle('api:sale', async (event, id) => storage.getSale(id));
ipcMain.handle('api:commit-sale', async (event, data) => storage.commitSale(data));
ipcMain.handle('api:customers', async (event, search) => storage.getCustomers(search));
ipcMain.handle('api:save-customer', async (event, data) => storage.saveCustomer(data));
ipcMain.handle('api:customer-payment', async (event, data) => storage.recordCustomerPayment(data));
ipcMain.handle('api:suppliers', async () => storage.getSuppliers());
ipcMain.handle('api:save-supplier', async (event, data) => storage.saveSupplier(data));
ipcMain.handle('api:purchases', async () => storage.getPurchases());
ipcMain.handle('api:save-purchase', async (event, data) => storage.recordPurchaseInvoice(data));
ipcMain.handle('api:shifts-current', async () => ({ success: true, session: storage.getActiveSession() }));
ipcMain.handle('api:open-shift', async (event, data) => storage.openShift(data));
ipcMain.handle('api:close-shift', async (event, data) => storage.closeShift(data));
ipcMain.handle('api:cash-movement', async (event, data) => storage.addCashMovement(data));
ipcMain.handle('api:shifts-history', async () => storage.getShiftsHistory());
ipcMain.handle('api:expenses', async () => storage.getExpenses());
ipcMain.handle('api:save-expense', async (event, data) => storage.recordExpense(data));
ipcMain.handle('api:employees', async () => storage.getEmployees());
ipcMain.handle('api:save-employee', async (event, data) => storage.saveEmployee(data));
ipcMain.handle('api:adjustment', async (event, data) => storage.recordAdjustment(data));
ipcMain.handle('api:payroll', async (event, { month, year }) => storage.getPayroll(month, year));
ipcMain.handle('api:calculate-payroll', async (event, data) => storage.calculatePayroll(data));
ipcMain.handle('api:pay-salary', async (event, id) => storage.paySalary(id));
ipcMain.handle('api:reports', async (event, type) => storage.getReports(type));
ipcMain.handle('api:backup', async () => {
  return { success: true, data: storage.data };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

