const { app, BrowserWindow, Menu, ipcMain } = require("electron/main")
const path = require("node:path")
const settings = require("./modules/settings.js")
const contextMenu = require("./modules/contextMenu.js")
const rpc = require("./modules/discordRpc.js")
let win = null

function createWindow() {
	win = new BrowserWindow({
		width: 1280,
		height: 720,
		title: "SoundCloud",
		backgroundColor: "rgb(18, 18, 18)",
		icon: path.join(__dirname, "icons", (process.platform == "win32") ? "icon.png" : "icon.ico"),
		
		webPreferences: {
			preload: path.join(__dirname, "modules", "preload.js"),
			sandbox: false
		}
	})
	
	win.on("page-title-updated", (e) => {
		e.preventDefault()
	})
	
	win.webContents.on("before-input-event", (e, input) => {
		if (input.type != "keyDown") return
		if (input.key == "I" && input.control && input.shift) {
			win.webContents.toggleDevTools()
		} else if (input.key == "F5") {
			win.webContents.reload()
		}
	})
	
	win.webContents.on("context-menu", (_, params) => {
		contextMenu.popup(win, params)
	})
		
	win.setMenu(null)
	win.loadURL("https://soundcloud.com/")
}

app.whenReady().then(() => {
	ipcMain.on("setTitle", (event, title) => {
		BrowserWindow.fromWebContents(event.sender).setTitle(title)
	})
	ipcMain.on("rpcSend", (_, ...args) => {
		rpc.send(...args)
	})
	settings.setUpIpcMain()
	
	createWindow()
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length == 0) {
			createWindow()
		}
	})
})

app.on("window-all-closed", () => {
	if (process.platform != "darwin") {
		rpc.close()
		app.quit()
	}
})

rpc.events.on("ready", () => {
	if (!win || win.isDestroyed()) return
	win.webContents.send("rpcReady")
})