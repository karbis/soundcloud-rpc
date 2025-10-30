const net = require("node:net")
const { Buffer } = require("node:buffer")
const fs = require("node:fs")
const path = require("node:path")
const EventEmitter = require("node:events")

let socket = null
let closed = false
let events = new EventEmitter()

let prefix = null
if (process.platform == "win32") {
	prefix = "\\\\?\\pipe\\discord-ipc-"
} else {
	let walkThroughDir = (dir) => {
		for (let file of fs.readdirSync(dir, {withFileTypes: true})) {
			if (prefix) break
			
			let fullPath = path.join(dir, file.name)
			if (file.isDirectory()) {
				try {
					walkThroughDir(fullPath)
				} catch {}
				continue
			}
			
			if (file.name.startsWith("discord-ipc-")) {
				prefix = fullPath.substring(0, fullPath.length - 1)
				break
			}
		}
	}
	walkThroughDir(process.env.XDG_RUNTIME_DIR ?? "/tmp/")
	// thank you linux
}

const APPLICATION_ID = "1353759684104028314"
const OPCODE = {
	HANDSHAKE: 0,
	FRAME: 1,
	CLOSE: 2,
	PING: 3,
	PONG: 4
}

function createSocket() {
	if (closed) return
	let created = false
	for (let i = 0; i < 10; i++) {
		if (!fs.existsSync(prefix+i)) continue
		created = true
		socket = net.createConnection(prefix + i)
		break
	}
	
	if (!created) {
		return setTimeout(createSocket, 5000)
	}
	
	socket.on("data", (chunk) => {
		let data = decodePacket(chunk)
		
		if (data.code == OPCODE.PING) {
			socket.wrte(createPacket(OPCODE.PONG, data.data))
		} else if (data.code == OPCODE.CLOSE) {
			socket.destroy()
		} else if (data.data.cmd == "DISPATCH" && data.data.evt == "READY") {
			events.emit("ready")
		}
	})

	socket.on("ready", () => {
		socket.write(createPacket(OPCODE.HANDSHAKE, {v: 1, client_id: APPLICATION_ID}))
	})
	
	socket.once("close", () => {
		setTimeout(createSocket, 5000)
		socket.destroy()
	})
}

//                    Buffer
function decodePacket(packet) {
	let opCode = packet.readInt32LE(0)
	let length = packet.readInt32LE(4)
	let data = JSON.parse(packet.toString("utf8", 8, 8 + length))
	
	return {
		code: opCode,
		data: data
	}
}

//                  number    object
function createPacket(opCode, data) {
	let json = JSON.stringify(data)
	let length = (new Blob([json])).size
	let buffer = Buffer.alloc(8 + length)
	buffer.writeInt32LE(opCode, 0)
	buffer.writeInt32LE(length, 4)
	buffer.write(json, 8)
	
	return buffer
}

//                 string   object
function sendEvent(command, payload) {
	if (!socket) return
	socket.write(createPacket(OPCODE.FRAME, {
		cmd: command,
		nonce: Math.random().toString(),
		args: payload
	}))
}

createSocket()

module.exports = {
	send: sendEvent,
	events: events,
	close: () => {
		socket.end(createPacket(OPCODE.CLOSE, {v: 1, client_id: APPLICATION_ID}))
		closed = true
	}
}