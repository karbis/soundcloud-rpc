const { Menu, clipboard } = require("electron/main")
const settings = require("./settings.js")

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

function getSettingsSubMenu() {
	let menu = []
	for (let setting of settings.info) {
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
		
		menu.push(item)
	}
	
	return menu
}

module.exports = {popup: contextMenuPopup}