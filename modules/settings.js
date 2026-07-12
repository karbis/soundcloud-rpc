const { ipcRenderer, ipcMain, BrowserWindow } = require("electron")
const EventEmitter = require("node:events")

let settingsInfo = [
	{name: "rpcEnabled", displayName: "RPC enabled", type: "boolean", default: true},
	{name: "pausedRpc", displayName: "Show RPC when paused", type: "boolean", default: true},
	{name: "showPausedInfo", displayName: "Show song info when paused", type: "boolean", default: true},
	{name: "showButtons", displayName: "Show buttons on activity", type: "boolean", default: false},
	{name: "statusDisplayType", displayName: "Status display type", type: "select", default: "Song name", values: ["Song name", "Song artist", "SoundCloud"]},
	
	{name: "lastFm_apiKey", type: "string", default: null, internal: true},
	{name: "lastFm_secret", type: "string", default: null, internal: true},
	{name: "lastFm_session", type: "string", default: null, internal: true},
	{name: "lastFm_scrobbling", type: "boolean", default: false, displayName: "Enable scrobbling", internal: true},
	
	{name: "proxy_url", type: "string", default: null, internal: true},
	{name: "proxy_enabled", type: "boolean", default: false, displayName: "Proxy enabled", internal: true},
	{name: "proxy_rawBytesToSearch", type: "boolean", default: false, displayName: "Convert raw bytes to search params", internal: true},
]
let settings = {}
let events = new EventEmitter()

// (renderer)
function load(storage) {
	for (let setting of settingsInfo) {
		let storageVal = storage.getItem(`soundcloud-rpc-${setting.name}`)	
		let val = undefined
		
		if (storageVal == undefined) {
			val = setting.default
		} else if (setting.type == "boolean") {
			val = storageVal == "true"
		} else if (storageVal == "null" || storageVal == "undefined") {
			val = null
		} else {
			val = storageVal
		}
		
		settings[setting.name] = val
	}
	ipcRenderer.send("setSettings", settings)
}

// (main)
function set(win, setting, value) {
	settings[setting] = value
	win.webContents.send("setSetting", {name: setting, value: value})
}

function setUpIpcPreload() {
	ipcRenderer.on("setSetting", (_, data) => {
		localStorage.setItem(`soundcloud-rpc-${data.name}`, data.value)
		settings[data.name] = data.value
		events.emit("settingChanged", data.name, data.value)
	})
}

function setUpIpcMain() {
	ipcMain.on("setSettings", (_, data) => {
		for (let [i, v] of Object.entries(data)) {
			settings[i] = v
		}
	})
	
	ipcMain.on("setSettingFromPreload", (event, name, value) => {
		let focused = BrowserWindow.getFocusedWindow()
		for (let win of BrowserWindow.getAllWindows()) {
			if (win != focused) { // to be called from modals, so the unfocused window should be the main one
				set(win, name, value)
				break
			}
		}
	})
	ipcMain.handle("getSettingFromPreload", async (event, name) => {
		return settings[name]
	})
}

module.exports = {
	info: settingsInfo,
	settings: settings,
	load: load,
	set: set,
	setUpIpcPreload: setUpIpcPreload,
	setUpIpcMain: setUpIpcMain,
	events: events
}