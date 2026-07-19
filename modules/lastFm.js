const settings = require("./settings.js")
const songMetadata = require("./songMetadata.js")
const { BrowserWindow } = require("electron")
const path = require("node:path")
const crypto = require("node:crypto")

function promptWithApiKeys(win) {
	let prompt = new BrowserWindow({parent: win, modal: true, show: false, title: "API Keys", width: 300, height: 190, resizable: false, webPreferences: {
		preload: path.join(__dirname, "windows", "promptPreload.js"),
		sandbox: false
	}})
	prompt.setMenu(null)
	prompt.loadFile("modules/windows/lastFmPrompt.html")
	prompt.once("ready-to-show", () => prompt.show())
}

async function connectAccount(win) {
	if (!apiKeysSetUp()) return

	let prompt = new BrowserWindow({parent: win, modal: true, show: false, title: "Last.fm", width: 1280, height: 720})
	prompt.loadURL(`http://www.last.fm/api/auth/?api_key=${settings.settings.lastFm_apiKey}&cb=https://soundcloud.com`)
	prompt.setMenu(null)
	prompt.once("ready-to-show", () => prompt.show())
	
	prompt.webContents.on("will-redirect", async (event) => {
		if (!event.url.startsWith("https://soundcloud.com/?token=")) return
		let token = new URL(event.url).searchParams.get("token")
		prompt.close()
		
		let sessionToken = null
		try {
			sessionToken = await sendLastFmRequest("GET", "auth.getSession", {token: token}, true)
		} catch (e) {
			return prompt("Error while fetching session token")
		}
		sessionToken = (await sessionToken.json())?.session?.key
		if (!sessionToken) return prompt("Error while fetching session token on the client")
		
		settings.set(win, "lastFm_session", sessionToken)
	})
}

function apiKeysSetUp() {
	return settings.settings.lastFm_apiKey != null && settings.settings.lastFm_secret != null
}

function isAccountConnected() {
	return settings.settings.lastFm_session != null
}

function sendLastFmRequest(method, protocol, args, addSignature) {
	let url = new URL("https://ws.audioscrobbler.com/2.0")
	args.method = protocol
	args.api_key = settings.settings.lastFm_apiKey
	if (addSignature) {
		args.api_sig = getLastFmSignature(args)
	}
	args.format = "json"
	
	if (method == "GET") {
		for (let [i, v] of Object.entries(args)) {
			url.searchParams.set(i, v)
		}
		
		return fetch(url.toString(), {method: method})
	} else {
		return fetch(url.toString(), {
			method: method,
			headers: {"Content-Type": "application/x-www-form-urlencoded"},
			body: new URLSearchParams(args)
		})
	}
}

function getLastFmSignature(args) {
	let stringArray = []
	let keys = Object.keys(args)
	keys.sort()
	
	for (let key of keys) {
		stringArray.push(key, args[key])
	}
	stringArray.push(settings.settings.lastFm_secret)
	
	let finalKey = stringArray.join("")
	return crypto.createHash("md5").update(finalKey, "utf8").digest("hex")
}

async function fetchAlbum(metadata) {
	return fetchLastFmAlbum(metadata) ?? fetchSoundcloudAlbum(metadata)
}

// method 1 (via lastfm)
async function fetchLastFmAlbum(metadata) {
	let albumRequest = null
	try {
		albumRequest = await sendLastFmRequest("GET", "track.getInfo", {
			track: metadata.songName,
			artist: metadata.artist.replaceAll(/\p{C}/gu, "") // remove invisible characters
		}, false)
	} catch {
		return null
	}
	
	let albumData = await albumRequest.json()
	if (!albumData.track) return null
	if (!albumData.track.album) return null
	if (albumData.track.name.toLowerCase() == albumData.track.album.title.toLowerCase()) return null // probably a single
	
	return albumData.track.album.title
}

// method 2 (via soundcloud)
async function fetchSoundcloudAlbum(metadata) {
	let urlData = new URL(metadata.songUrlFull)
	if (!urlData.searchParams.has("in")) return null
	if (urlData.searchParams.get("in").split("/")[0] != new URL(metadata.artistUrl).pathname.substring(1)) return null // playlist check
	
	let pageRequest = null
	try {
		pageRequest = await fetch(metadata.songUrlFull)
	} catch (e) {
		return null
	}
	
	let pageText = await pageRequest.text()
	let pageDom = (new DOMParser()).parseFromString(pageText, "text/html")
	let startStr = `Listen to ${metadata.songName} by ${metadata.artist} `
	let titleCutoff = pageDom.title.substring(startStr.length)
	let matchResult = titleCutoff.match(/^in (.+) playlist/)
	
	if (matchResult) {
		return matchResult[1]
	}
	
	for (let scriptElement of pageDom.querySelectorAll("script")) {
		if (!scriptElement.text.startsWith("window.__sc_hydration = ")) continue
		
		let data = JSON.parse(scriptElement.text.substring("window.__sc_hydration = ".length, scriptElement.text.length - 1))
		for (let table of data) {
			if (table.hydratable != "sound") continue
			return table.data.publisher_metadata?.album_title
		}
		break
	}
}

async function init() {
	await new Promise((r) => document.addEventListener("DOMContentLoaded", r))
	await songMetadata.init()
	let getHash = (metadata) => `${metadata.artist}_${metadata.songName}`
	
	let pendingScrobble = null
	let listeningTime = 0
	let lastHash = null
	let lastCurTime = 0
	let startedListening = null
	
	async function checkScrobble() {
		let scrobble = pendingScrobble
		pendingScrobble = null
		if (scrobble == null) return
		
		let response = null
		let album = await fetchAlbum(scrobble)
		try {
			let scrobbleData = {
				artist: scrobble.artist,
				track: scrobble.songName,
				timestamp: Math.floor(startedListening / 1000),
				duration: scrobble.duration,
				sk: settings.settings.lastFm_session,
			}
			if (album) {
				scrobbleData.album = album
			}
			
			response = await sendLastFmRequest("POST", "track.scrobble", scrobbleData, true)
		} catch (e) {
			return
		}
		
		response = await response.json()
		if (response.error) {
			if (response.error == 9) {
				settings.settings.lastFm_session = null
				for (let win of BrowserWindow.getAllWindows()) {
					settings.set(win, "lastFm_session", null)
				}
			}
			return
		}		
	}
	
	songMetadata.onSongMetadataChanged(() => {
		if (!isAccountConnected()) return
		if (!settings.settings.lastFm_scrobbling) return
		let metadata = songMetadata.getSongMetadata()
		
		let curHash = getHash(metadata)
		if (curHash != lastHash)  {
			lastHash = curHash
			checkScrobble()
			listeningTime = 0
			lastCurTime = metadata.curTime
			startedListening = Date.now()
		}
		if (metadata.duration <= 30) return
		if (!metadata.playing) return
		
		let curTime = metadata.curTime
		if (curTime - lastCurTime != 1 && curTime - lastCurTime != 0) {
			listeningTime = 0
			
			if (curTime == 0) {
				if (lastCurTime >= metadata.duration - 3) {
					checkScrobble()
				}
				startedListening = Date.now()
			} else {
				pendingScrobble = null
			}
		} else {
			listeningTime += curTime - lastCurTime
		}
		lastCurTime = curTime
		
		if (pendingScrobble == null && listeningTime >= Math.min(4 * 60, metadata.duration / 2)) {
			pendingScrobble = metadata
		}
	})
}

module.exports = {
	promptWithApiKeys,
	connectAccount,
	isAccountConnected,
	apiKeysSetUp,
	init
}