const { contextBridge, ipcMain, ipcRenderer, BrowserWindow } = require("electron")

contextBridge.exposeInMainWorld("preload", {
	close: () => ipcRenderer.send("closeWindow"),
	setSetting: (name, value) => ipcRenderer.send("setSettingFromPreload", name, value),
	getSetting: (name) => ipcRenderer.invoke("getSettingFromPreload", name)
})