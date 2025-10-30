const { app, BrowserWindow, Menu } = require("electron/main")
const path = require("node:path")

function createWindow() {
	let win = new BrowserWindow({
		width: 1280,
		height: 720,
		title: "Soundcloud",
		backgroundColor: "rgb(18, 18, 18)",
		icon: path.join(__dirname, "icons", (process.platform == "win32") ? "icon.png" : "icon.ico"),
		
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
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
		let navigation = win.webContents.navigationHistory
		let template = [
			{ label: "Back", enabled: navigation.canGoBack(), click: () => navigation.goBack() },
			{ label: "Forward", enabled: navigation.canGoForward(), click: () => navigation.goForward() },
			{ role: "reload", accelerator: "F5" }
		]
		
		if (params.selectionText != "") {
			template.push({type: "separator"})
			template.push({role: "copy", accelerator: "Ctrl+C"})
		}
		
		template.push({type: "separator"})
		template.push({role: "toggleDevTools", accelerator: "Ctrl+Shift+I", label: "Inspect"})
		
		let contextMenu = Menu.buildFromTemplate(template)
		contextMenu.popup()
	})
	
	win.setMenu(null)
	win.loadURL("https://soundcloud.com/")
}

app.whenReady().then(() => {
	createWindow()
	
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length == 0) {
			createWindow()
		}
	})
})

app.on("window-all-closed", () => {
	if (process.platform != "darwin") {
		app.quit()
	}
})