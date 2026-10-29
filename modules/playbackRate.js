const settings = require("./settings.js")
const lastFm = require("./lastFm.js")
const { BrowserWindow, contextBridge } = require("electron")
const path = require("node:path")

function promptSetting(win) {
	lastFm.promptWindow(win, "Playback Rate", "playbackRatePrompt", 300, 190)
}

async function init() {
	contextBridge.executeInMainWorld({func: (initSpeed, initPitch) => {
		let ogCreateElement = document.createElement
		let audioElements = []
		let speed = initSpeed
		let preservePitch = initPitch
	
		function updateAudioElement(element) {
			element.playbackRate = speed
			element.defaultPlaybackRate = element.playbackRate
			element.preservesPitch = preservePitch
		}
	
		document.createElement = (name, ...args) => {
			let element = ogCreateElement.call(document, name, ...args)
	
			if (name == "audio") {
				audioElements.push(element)
				updateAudioElement(element)
			}
	
			return element
		}
	
		window._soundcloudRpc_updateRate = (rate, pitch) => {
			speed = rate
			preservePitch = pitch
			audioElements.forEach(updateAudioElement)
		}
	}, args: [settings.settings.playbackRate, settings.settings.playbackRate_preservePitch]})
	
	settings.events.on("settingChanged", () => {
		contextBridge.executeInMainWorld({func: (rate, pitch) => { window._soundcloudRpc_updateRate(rate, pitch) }, args: [settings.settings.playbackRate, settings.settings.playbackRate_preservePitch]})
	})
}

module.exports = {
	promptSetting,
	init
}