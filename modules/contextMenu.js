const { Menu, clipboard } = require("electron/main")
const settings = require("./settings.js")
const lastFm = require("./lastFm.js")
const proxy = require("./proxy.js")

function contextMenuPopup(win, params) {
	let navigation = win.webContents.navigationHistory
	let template = [
		{ label: "Back", enabled: navigation.canGoBack(), click: () => navigation.goBack() },
		{ label: "Forward", enabled: navigation.canGoForward(), click: () => navigation.goForward() },
		{ role: "reload", accelerator: "F5" }
	]
	
	let contextualItems = []
	if (params.linkURL != "") {
		contextualItems.push({label: "Copy link address", click: () => clipboard.writeText(params.linkURL)})
	}
	if (params.selectionText != "") {
		contextualItems.push({role: "copy", accelerator: "Ctrl+C"})
	}
	
	if (contextualItems.length != 0) {
		template.push({type: "separator"}, ...contextualItems)
	}
	
	template.push({type: "separator"})
	template.push({label: "Settings", submenu: getSettingsSubMenu()})
	template.push({role: "toggleDevTools", accelerator: "Ctrl+Shift+I", label: "Inspect"})
	
	let contextMenu = Menu.buildFromTemplate(template)
	contextMenu.popup()
}

	
function getSettingInfo(name) {
	for (let setting of settings.info) {
		if (setting.name == name) {
			return setting
		}
	}
}

function getSettingsSubMenu() {
	let newSetting = (setting) => {
		let item = {label: setting.displayName}
		let curVal = settings.settings[setting.name]
		
		if (setting.type == "boolean") {
			item.type = "checkbox"
			item.checked = curVal
			item.click = (_, win) => settings.set(win, setting.name, !curVal)
		} else if (setting.type == "select") {
			let subMenu = []
			for (let value of setting.values) {
				subMenu.push({label: value, type: "checkbox", checked: curVal == value, click: (_, win) => settings.set(win, setting.name, value)})
			}
			
			item.submenu = subMenu
		}
		
		return item
	}
	
	let menu = []
	for (let setting of settings.info) {
		if (setting.internal) continue
		menu.push(newSetting(setting))
	}
	
	menu.push({type: "separator"})
	menu.push({label: "Last.fm settings", submenu: [
		{
			label: "Set API keys",
			click: (_, win) => lastFm.promptWithApiKeys(win),
		},
		{
			label: "Connect account",
			click: (_, win) => lastFm.connectAccount(win),
			type: "checkbox",
			checked: lastFm.isAccountConnected()
		},
		{type: "separator"},
		newSetting(getSettingInfo("lastFm_scrobbling"))
	]})
	menu.push({label: "Proxy settings", submenu: [
		{
			label: "Set Proxy URL",
			click: (_, win) => proxy.promptUrlChange(win)
		},
		newSetting(getSettingInfo("proxy_enabled"))
	]})
	
	return menu
}

module.exports = {popup: contextMenuPopup}