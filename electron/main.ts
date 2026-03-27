import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const API_CLIENT = axios.create({
  baseURL: 'https://www.touchgal.top/api',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
});

// 📂 Local Scanner Logic
const scanForGalgameFolders = (rootPaths: string[]) => {
  const results: any[] = []
  
  rootPaths.forEach(rootPath => {
    if (!fs.existsSync(rootPath)) return

    const dirs = fs.readdirSync(rootPath, { withFileTypes: true })
    dirs.forEach(dir => {
      if (dir.isDirectory()) {
        const fullPath = path.join(rootPath, dir.name)
        const tgIdPath = path.join(fullPath, '.tg_id')
        
        if (fs.existsSync(tgIdPath)) {
          const id = fs.readFileSync(tgIdPath, 'utf8').trim()
          results.push({
            path: fullPath,
            folderName: dir.name,
            tg_id: id
          })
        } else {
          results.push({
            path: fullPath,
            folderName: dir.name,
            tg_id: null
          })
        }
      }
    })
  })
  
  return results
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- IPC Handlers ---
ipcMain.handle('scan-local-library', (_event, paths: string[]) => {
  return scanForGalgameFolders(paths)
})

ipcMain.handle('tag-folder', (_event, folderPath: string, id: string) => {
  const tgIdPath = path.join(folderPath, '.tg_id')
  try {
    fs.writeFileSync(tgIdPath, id, 'utf8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err }
  }
})

// --- TouchGal API Relay (Bypass CORS) ---
ipcMain.handle('tg-fetch-resources', async (_event, page, limit, query) => {
  const res = await API_CLIENT.get('/galgame', { params: { page, limit, ...query } })
  return res.data
})

ipcMain.handle('tg-search-resources', async (_event, keyword, page, limit) => {
  const res = await API_CLIENT.post('/search', { keyword, page, limit, mode: 'tag' })
  return res.data
})

ipcMain.handle('tg-get-patch-detail', async (_event, uniqueId) => {
  const res = await API_CLIENT.get('/patch', { params: { uniqueId } })
  return res.data
})

ipcMain.handle('tg-get-patch-introduction', async (_event, uniqueId) => {
  const res = await API_CLIENT.get('/patch/introduction', { params: { uniqueId } })
  return res.data
})

ipcMain.handle('tg-fetch-captcha', async () => {
  const res = await API_CLIENT.get('/captcha', { responseType: 'arraybuffer' })
  const base64 = Buffer.from(res.data).toString('base64')
  return `data:image/png;base64,${base64}`
})

ipcMain.handle('tg-login', async (_event, username, password, captcha) => {
  const res = await API_CLIENT.post('/login', { username, password, captcha })
  return res.data
})

app.whenReady().then(createWindow)
