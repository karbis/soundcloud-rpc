const { BrowserWindow, session } = require("electron")
const path = require("node:path")
const settings = require("./settings.js")

function promptUrlChange(win) {
	let prompt = new BrowserWindow({parent: win, modal: true, show: false, title: "Proxy URL", width: 310, height: 150, resizable: false, webPreferences: {
		preload: path.join(__dirname, "windows", "promptPreload.js"),
		sandbox: false
	}})
	prompt.setMenu(null)
	prompt.loadFile("modules/windows/proxyPrompt.html")
	prompt.once("ready-to-show", () => prompt.show())
}

function canProxy(details) {
	if (!settings.settings.proxy_enabled) return false
	if (settings.settings.proxy_url == null) return false
	if (!details.url.startsWith("http")) return false
	return true
}

function init() {
	session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
		if (!canProxy(details)) return callback({})
		
		let proxyUrl = settings.settings.proxy_url
		if (proxyUrl.endsWith("/")) {
			proxyUrl = proxyUrl.substr(0, proxyUrl.length - 1)
		}
		if (!proxyUrl.startsWith("http")) {
			proxyUrl = "https://" + proxyUrl
		}
		
		let url = new URL(details.url)
		let shouldProxy = (url.hostname == "api-v2.soundcloud.com" &&
			(url.pathname == "/tracks" || (url.pathname.startsWith("/playlists/") && /\d$/g.test(url.pathname)) || url.pathname.startsWith("/media/soundcloud:tracks:") || url.pathname.startsWith("/stream/users/")))
			|| (url.hostname == "license.media-streaming.soundcloud.cloud" && url.pathname == "/playback/widevine")
		
		if (shouldProxy) {
			let redirect = proxyUrl + url.pathname + url.search
			return callback({redirectURL: redirect})
		}
		
		callback({})
	})
}

module.exports = {
	promptUrlChange,
	init
}