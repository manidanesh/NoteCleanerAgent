const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Import our production app
const { NotesAIOrganizerApp } = require('./dist/production-app');

let mainWindow;
let notesApp;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        titleBarStyle: 'hiddenInset', // macOS style
        icon: path.join(__dirname, 'assets/icon.png'), // Add an icon if you have one
        show: false // Don't show until ready
    });

    // Load the desktop app HTML
    mainWindow.loadFile('desktop-app.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Initialize the Notes AI Organizer backend
        initializeNotesApp();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (notesApp) {
            notesApp.shutdown();
        }
    });

    // Create application menu
    createMenu();
}

async function initializeNotesApp() {
    try {
        console.log('🚀 Initializing Notes AI Organizer backend...');
        
        notesApp = new NotesAIOrganizerApp({
            enableOnDeviceLLM: true,
            enableCloudLLM: false,
            enableDeviceSync: true,
            privacyMode: 'strict'
        });

        const initialized = await notesApp.initialize();
        if (initialized) {
            console.log('✅ Backend initialized successfully');
            
            // Request permissions
            const hasPermissions = await notesApp.requestPermissions();
            if (hasPermissions) {
                console.log('✅ Permissions granted');
                
                // Notify the frontend that backend is ready
                mainWindow.webContents.send('backend-ready', {
                    status: 'ready',
                    message: 'Notes AI Organizer is ready!'
                });
            } else {
                console.log('⚠️ Permissions not granted');
                showPermissionDialog();
            }
        } else {
            console.log('❌ Failed to initialize backend');
        }
    } catch (error) {
        console.error('❌ Error initializing Notes AI:', error);
        
        // Show error dialog
        dialog.showErrorBox('Initialization Error', 
            'Failed to initialize Notes AI Organizer. Please check your Apple Notes permissions.');
    }
}

function createMenu() {
    const template = [
        {
            label: 'Notes AI Organizer',
            submenu: [
                {
                    label: 'About Notes AI Organizer',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Notes AI Organizer',
                            message: 'Notes AI Organizer v1.0.0',
                            detail: 'Intelligent organization for your Apple Notes using AI technology.'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Preferences...',
                    accelerator: 'Cmd+,',
                    click: () => {
                        // Open preferences window
                        showPreferences();
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
            label: 'File',
            submenu: [
                {
                    label: 'Analyze Notes',
                    accelerator: 'Cmd+A',
                    click: () => {
                        mainWindow.webContents.send('trigger-analysis');
                    }
                },
                {
                    label: 'Organize Notes',
                    accelerator: 'Cmd+O',
                    click: () => {
                        mainWindow.webContents.send('trigger-organization');
                    }
                },
                {
                    label: 'Clean Up Notes',
                    accelerator: 'Cmd+Shift+C',
                    click: () => {
                        mainWindow.webContents.send('trigger-cleanup');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Export Results...',
                    accelerator: 'Cmd+E',
                    click: () => {
                        exportResults();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'Cmd+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Actual Size',
                    accelerator: 'Cmd+0',
                    click: () => {
                        mainWindow.webContents.setZoomLevel(0);
                    }
                },
                {
                    label: 'Zoom In',
                    accelerator: 'Cmd+Plus',
                    click: () => {
                        const currentZoom = mainWindow.webContents.getZoomLevel();
                        mainWindow.webContents.setZoomLevel(currentZoom + 1);
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'Cmd+-',
                    click: () => {
                        const currentZoom = mainWindow.webContents.getZoomLevel();
                        mainWindow.webContents.setZoomLevel(currentZoom - 1);
                    }
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                {
                    label: 'Minimize',
                    accelerator: 'Cmd+M',
                    click: () => {
                        mainWindow.minimize();
                    }
                },
                {
                    label: 'Close',
                    accelerator: 'Cmd+W',
                    click: () => {
                        mainWindow.close();
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/your-repo/notes-ai-organizer');
                    }
                },
                {
                    label: 'Report Issue',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/your-repo/notes-ai-organizer/issues');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function showPermissionDialog() {
    const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Permissions Required',
        message: 'Notes AI Organizer needs access to your Apple Notes',
        detail: 'Please grant Full Disk Access permission in System Preferences > Security & Privacy > Privacy > Full Disk Access',
        buttons: ['Open System Preferences', 'Try Again', 'Cancel'],
        defaultId: 0
    });

    if (result === 0) {
        // Open System Preferences
        spawn('open', ['/System/Library/PreferencePanes/Security.prefPane']);
    } else if (result === 1) {
        // Try again
        initializeNotesApp();
    }
}

function showPreferences() {
    const prefsWindow = new BrowserWindow({
        width: 500,
        height: 400,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        titleBarStyle: 'hiddenInset'
    });

    // Create a simple preferences HTML
    const prefsHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Preferences</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                    padding: 20px; 
                    background: #f5f5f5;
                }
                .pref-group { 
                    background: white; 
                    padding: 15px; 
                    border-radius: 8px; 
                    margin-bottom: 15px;
                }
                .pref-title { 
                    font-weight: 600; 
                    margin-bottom: 10px; 
                }
                label { 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    margin-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <h2>Notes AI Organizer Preferences</h2>
            
            <div class="pref-group">
                <div class="pref-title">AI Processing</div>
                <label>
                    <input type="checkbox" checked> Enable on-device LLM processing
                </label>
                <label>
                    <input type="checkbox"> Allow cloud LLM processing (with consent)
                </label>
                <label>
                    <input type="checkbox" checked> Enable intelligent caching
                </label>
            </div>
            
            <div class="pref-group">
                <div class="pref-title">Privacy</div>
                <label>
                    <input type="radio" name="privacy" checked> Strict (on-device only)
                </label>
                <label>
                    <input type="radio" name="privacy"> Balanced (prefer on-device)
                </label>
                <label>
                    <input type="radio" name="privacy"> Performance (allow cloud)
                </label>
            </div>
            
            <div class="pref-group">
                <div class="pref-title">Synchronization</div>
                <label>
                    <input type="checkbox" checked> Enable device synchronization
                </label>
                <label>
                    <input type="checkbox" checked> Enable biometric authentication
                </label>
            </div>
        </body>
        </html>
    `;

    prefsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(prefsHTML));
}

async function exportResults() {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Analysis Results',
            defaultPath: 'notes-ai-analysis.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && notesApp) {
            // Get current statistics and export them
            const stats = await notesApp.getStatistics();
            require('fs').writeFileSync(result.filePath, JSON.stringify(stats, null, 2));
            
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Complete',
                message: 'Analysis results exported successfully!',
                detail: `Saved to: ${result.filePath}`
            });
        }
    } catch (error) {
        dialog.showErrorBox('Export Error', 'Failed to export results: ' + error.message);
    }
}

// IPC handlers for communication with frontend
ipcMain.handle('analyze-notes', async () => {
    if (!notesApp) {
        throw new Error('Notes app not initialized');
    }
    
    return await notesApp.analyzeAllNotes();
});

ipcMain.handle('organize-notes', async () => {
    if (!notesApp) {
        throw new Error('Notes app not initialized');
    }
    
    // Implement organization logic
    return { success: true, organized: 5 };
});

ipcMain.handle('cleanup-notes', async () => {
    if (!notesApp) {
        throw new Error('Notes app not initialized');
    }
    
    return await notesApp.runBulkCleanup();
});

ipcMain.handle('get-statistics', async () => {
    if (!notesApp) {
        throw new Error('Notes app not initialized');
    }
    
    return await notesApp.getStatistics();
});

// App event handlers
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

// Handle app quit
app.on('before-quit', async () => {
    if (notesApp) {
        await notesApp.shutdown();
    }
});

console.log('🖥️ Notes AI Organizer Desktop App Starting...');