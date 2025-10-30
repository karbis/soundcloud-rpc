const rpc = require("./discordRpc.js")
const { ipcRenderer } = require("electron")

//type activity = {
//	name: string,
//	state: string?,
//	details: string,
//  extraField: string?,
//	timestamps: {current: number, end: number}?,
//	assets: {
//		image: string,
//		text: string,
//      url: string
//	}
//}
function setActivity(activity) {
	if (activity == null) {
		return rpc.send("SET_ACTIVITY", {pid: process.pid})
	}
	
	let now = Date.now()
	activity.assets.text = activity.assets.text?.padEnd(2, " ")?.substring(0, 128)
	activity.assets.url = activity.assets.url?.substring(0, 256)
	
	let activityPayload = {
		state: activity.state?.padEnd(2, " ")?.substring(0, 128),
		details: activity.details?.padEnd(2, " ")?.substring(0, 128),
		name: activity.name,
		type: 2,
		status_display_type: 2,
		created_at: now,
		assets: {
			small_image: activity.assets.image,
			small_text: activity.assets.text,
			small_url: activity.assets.url
		},
		instance: true
	}
	
	if (activity.timestamps) {
		activityPayload.timestamps = {start: now - activity.timestamps.current * 1000, end: now + activity.timestamps.end * 1000 - activity.timestamps.current * 1000}
	}
	if (activity.extraField) {
		activityPayload.assets = {
			large_image: activity.assets.image,
			large_text: activity.extraField,
			large_url: activity.assets.url
		}
	}
	
	let payload = {
		pid: process.pid,
		activity: activityPayload
	}
	rpc.send("SET_ACTIVITY", payload)
}

function waitForQuery(target, query) {
	return new Promise(async (resolve) => {
		if (target.querySelector(query)) { resolve(target.querySelector(query)); return }
		let observer = new MutationObserver((records) => {
			let controls = target.querySelector(query)
			if (!controls) return
			observer.disconnect()
			resolve(controls)
		})
		
		observer.observe(target, {subTree: true, childList: true, attributes: true})
	})
}

document.addEventListener("DOMContentLoaded", async () => {
	let controls = await waitForQuery(document.documentElement, ".playControls__elements")
	
	let progressBar = controls.querySelector(".playControls__timeline > div > .playbackTimeline__progressWrapper")
	let playButton = controls.querySelector(".playControls__play")
	
	let panel = controls.querySelector(".playControls__soundBadge > div")
	await waitForQuery(panel, "a > div > span")
	
	function getSongMetadata() {
		let titleContext = panel.querySelector(".playbackSoundBadge__titleContextContainer")
		let artist = titleContext.querySelector("a")
		let url = panel.querySelector("div > a")
		let songName = panel.querySelector("div > a > span[aria-hidden='true']")
		let img = panel.querySelector("a > div > span")
		
		let imgUrl = img.style.backgroundImage.replace("50x50.", "500x500.")
		imgUrl = imgUrl.substring(5, imgUrl.length - 2)
		
		let urlObj = new URL(url.href)		
		return {
			playing: playButton.classList.contains("playing"),
			duration: parseInt(progressBar.getAttribute("aria-valuemax")),
			curTime: parseInt(progressBar.getAttribute("aria-valuenow")),
			img: imgUrl,
			artist: artist.innerText,
			songName: songName.innerText,
			url: urlObj.origin + urlObj.pathname
		}
	}
	
	function getHashedMetadata(metadata) {
		return `${metadata.songName}_${metadata.artist}_${metadata.playing}`
	}
	
	let curSong = null
	let curTimeMetadata = {val: -1, timestamp: 0}
	function update() {
		let metadata = getSongMetadata()
		let hash = getHashedMetadata(metadata)
		let shouldUpdate = curSong != hash || Math.abs(metadata.curTime - (curTimeMetadata.val + Math.floor((Date.now() - curTimeMetadata.timestamp) / 1000))) >= 3
		
		if (!shouldUpdate) return
		curSong = hash
		curTimeMetadata = {val: metadata.curTime, timestamp: Date.now()}
		
		let activity = {
			details: metadata.songName,
			state: metadata.artist,
			name: "SoundCloud",
			assets: {
				image: metadata.img,
				text: metadata.songName,
				url: metadata.url
			},
		}
		
		if (metadata.playing) {
			activity.timestamps = {current: metadata.curTime, end: metadata.duration}
		} else {
			activity.extraField = "Paused"
		}
		
		setActivity(activity)
		ipcRenderer.send("setTitle", `${metadata.artist} - ${metadata.songName} | SoundCloud`)
	}
	
	update()
	rpc.events.once("ready", () => {
		curSong = null
		update()
	})
	let observer = new MutationObserver(update)
	for (let target of [panel, playButton, progressBar]) {
		observer.observe(target, {attributes: true, characterData: true, childList: true})
	}
})