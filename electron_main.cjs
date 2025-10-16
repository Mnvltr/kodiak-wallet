const { app, BrowserWindow, shell, ipcMain, protocol } = require('electron');
const { join } = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Registrar protocolo personalizado para comunicación
app.setAsDefaultProtocolClient('kodiak');

// Manejar la apertura de URLs externas
ipcMain.handle('open-external-url', async (event, url) => {
  console.log('Opening external URL:', url);
  shell.openExternal(url);
});

// Manejar datos de wallet recibidos desde la web
ipcMain.handle('wallet-data-received', async (event, walletData) => {
  console.log('Wallet data received from web:', walletData);
  // Enviar datos al renderer process
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send('wallet-connected', walletData);
  }
});

// Manejar protocolo personalizado
function handleKodiakProtocol(url) {
  console.log('Kodiak protocol called:', url);
  
  // Parsear datos de la URL
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);
  
  if (urlObj.pathname === '//wallet-connected') {
    // Enviar datos de wallet a la ventana principal
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('wallet-connected', {
        address: params.address,
        publicKey: params.publicKey,
        timestamp: params.timestamp
      });
      
      // Enfocar la ventana
      windows[0].focus();
      windows[0].show();
    }
  }
}

// Manejar el protocolo en Windows
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Alguien intentó ejecutar una segunda instancia, enfocar nuestra ventana
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
  
  // Verificar si hay llamada de protocolo
  const protocolCall = commandLine.find(arg => arg.startsWith('kodiak://'));
  if (protocolCall) {
    handleKodiakProtocol(protocolCall);
  }
});

// Manejar el protocolo en macOS/Linux
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleKodiakProtocol(url);
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'electron_preload.cjs')
    },
    icon: join(__dirname, 'public/logo.png'),
    title: 'Kodiak Wallet'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // Verificar si la app fue abierta por un protocolo
  if (process.platform === 'win32' && process.argv.length >= 2) {
    const protocolCall = process.argv.find(arg => arg.startsWith('kodiak://'));
    if (protocolCall) {
      handleKodiakProtocol(protocolCall);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});