const rpc = require("./discordRpc.js")
const settings = require("./settings.js")
const songMetadata = require("./songMetadata.js")
const { ipcRenderer } = require("electron")
settings.load(localStorage)
settings.setUpIpcPreload()

//type activity = {
//	name: string,
//	state: string?,
//  stateUrl: string?,
//  detailsUrl: string?,
//	details: string,
//	statusDisplayType: number,
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
		state_url: activity.stateUrl?.substring(0, 256),
		details_url: activity.detailsUrl?.substring(0, 256),
		name: activity.name,
		type: 2,
		status_display_type: activity.statusDisplayType,
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

document.addEventListener("DOMContentLoaded", async () => {
	await songMetadata.init()
	
	let curSong = null
	let curTimeMetadata = {val: -1, timestamp: 0}
	function update() {
		let metadata = songMetadata.getSongMetadata()
		let hash = songMetadata.getHashedMetadata(metadata)
		let shouldUpdate = curSong != hash || Math.abs(metadata.curTime - (curTimeMetadata.val + Math.floor((Date.now() - curTimeMetadata.timestamp) / 1000))) >= 3
		
		if (!shouldUpdate) return
		curSong = hash
		curTimeMetadata = {val: metadata.curTime, timestamp: Date.now()}
		
		if (!settings.settings.rpcEnabled) return setActivity(null)
	
		let settingToDisplayType = {"Song name": 2, "Song artist": 1, "SoundCloud": 0}
		let activity = {
			details: metadata.songName,
			state: metadata.artist,
			stateUrl: metadata.artistUrl,
			detailsUrl: metadata.songUrl,
			
			statusDisplayType: settingToDisplayType[settings.settings.statusDisplayType],
			name: "SoundCloud",
			
			assets: {
				image: metadata.img,
				text: metadata.songName,
				url: metadata.songUrl
			},
		}
		
		if (metadata.playing) {
			activity.timestamps = {current: metadata.curTime, end: metadata.duration}
		} else {
			if (settings.settings.showPausedInfo) {
				activity.extraField = "Paused"
			} else {
				delete activity.stateUrl
				delete activity.detailsUrl
				delete activity.assets.url
				activity.assets.text = "SoundCloud"
				activity.assets.image = "soundcloud-icon"
				activity.details = "SoundCloud"
				activity.state = "Paused"
			}
		}
		
		setActivity(activity)
		ipcRenderer.send("setTitle", `${metadata.artist} - ${metadata.songName} | SoundCloud`)
	}
	
	let forceUpdate = () => {
		curSong = null
		update()
	}
	update()
	rpc.events.once("ready", forceUpdate)
	songMetadata.onSongMetadataChanged(update)
	settings.events.on("settingChanged", forceUpdate)
})