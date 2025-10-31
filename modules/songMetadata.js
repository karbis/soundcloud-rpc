let controls = null
let panel = null
let progressBar = null
let playButton = null

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

async function init() {
	controls = await waitForQuery(document.documentElement, ".playControls__elements")
	panel = controls.querySelector(".playControls__soundBadge > div")
	progressBar = controls.querySelector(".playControls__timeline > div > .playbackTimeline__progressWrapper")
	playButton = controls.querySelector(".playControls__play")
	
	await waitForQuery(panel, "a > div > span")
}

function getSongMetadata() {
	let titleContext = panel.querySelector(".playbackSoundBadge__titleContextContainer")
	let artist = titleContext.querySelector("a")
	let url = panel.querySelector("div > a")
	let songName = panel.querySelector("div > a > span[aria-hidden='true']")
	let img = panel.querySelector("a > div > span")
	
	let imgUrl = img.style.backgroundImage.replace("50x50.", "500x500.")
	imgUrl = imgUrl.substring(5, imgUrl.length - 2)
	
	let songUrl = new URL(url.href)
	let artistUrl = new URL(artist.href)
	return {
		playing: playButton.classList.contains("playing"),
		duration: parseInt(progressBar.getAttribute("aria-valuemax")),
		curTime: parseInt(progressBar.getAttribute("aria-valuenow")),
		img: imgUrl,
		artist: artist.innerText,
		songName: songName.innerText,
		songUrl: songUrl.origin + songUrl.pathname,
		artistUrl: artistUrl.origin + artistUrl.pathname
	}
}

function getHashedMetadata(metadata) {
	return `${metadata.songName}_${metadata.artist}_${metadata.playing}`
}

function onSongMetadataChanged(callback) {
	let observer = new MutationObserver(callback)
	for (let target of [panel, playButton, progressBar]) {
		observer.observe(target, {attributes: true, characterData: true, childList: true})
	}
}

module.exports = {init, getSongMetadata, getHashedMetadata, onSongMetadataChanged}