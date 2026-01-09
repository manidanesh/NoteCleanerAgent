const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import our AI engine
const NotesAIOrganizer = require('./macos-app.js');

class NotesAIApp {
  constructor() {
    this.mainWindow = null;
    this.aiOrganizer = new NotesAIOrganizer();
  }

  createWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'assets/icon.png'), // We'll create this
      show: false // Don't show until ready
    });

    // Load the app
    this.mainWindow.loadFile('simple-app.html');

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Focus on macOS
      if (process.platform === 'darwin') {
        app.focus();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }
  }

  createMenu() {
    const template = [
      {
        label: 'Notes AI Organizer',
        submenu: [
          {
            label: 'About Notes AI Organizer',
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'About',
                message: 'Notes AI Organizer v1.0.0',
                detail: 'AI-powered note organization for macOS\nBuilt with Electron and advanced AI algorithms'
              });
            }
          },
          { type: 'separator' },
          {
            label: 'Preferences...',
            accelerator: 'Cmd+,',
            click: () => {
              this.mainWindow.webContents.send('show-preferences');
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: 'Cmd+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Analysis',
        submenu: [
          {
            label: 'Run Full Analysis',
            accelerator: 'Cmd+R',
            click: () => {
              this.mainWindow.webContents.send('run-analysis');
            }
          },
          {
            label: 'Find Duplicates',
            accelerator: 'Cmd+D',
            click: () => {
              this.mainWindow.webContents.send('find-duplicates');
            }
          },
          {
            label: 'Detect Junk Notes',
            accelerator: 'Cmd+J',
            click: () => {
              this.mainWindow.webContents.send('detect-junk');
            }
          },
          {
            label: 'Organization Suggestions',
            accelerator: 'Cmd+O',
            click: () => {
              this.mainWindow.webContents.send('organization-suggestions');
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupIPC() {
    // Handle AI analysis requests
    ipcMain.handle('run-full-analysis', async () => {
      try {
        const results = await this.aiOrganizer.analyzeAllNotes();
        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('find-duplicates', async () => {
      try {
        const duplicates = this.aiOrganizer.findDuplicates();
        return { success: true, data: duplicates };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('detect-junk', async () => {
      try {
        const junkNotes = this.aiOrganizer.findJunkNotes();
        return { success: true, data: junkNotes };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('organization-suggestions', async () => {
      try {
        const suggestions = this.aiOrganizer.generateOrganizationSuggestions();
        return { success: true, data: suggestions };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-utility-scores', async () => {
      try {
        const scores = this.aiOrganizer.calculateUtilityScores();
        return { success: true, data: scores };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Handle settings
    ipcMain.handle('get-settings', async () => {
      return this.aiOrganizer.settings;
    });

    ipcMain.handle('save-settings', async (event, settings) => {
      try {
        this.aiOrganizer.settings = { ...this.aiOrganizer.settings, ...settings };
        // Save to file (implement in aiOrganizer)
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  init() {
    // This method will be called when Electron has finished initialization
    app.whenReady().then(() => {
      this.createWindow();
      this.createMenu();
      this.setupIPC();

      app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Quit when all windows are closed
    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
      });
    });
  }
}

// Create and initialize the app
const notesApp = new NotesAIApp();
notesApp.init();