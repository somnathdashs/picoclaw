const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const WIN_EPOCH = 11644473600
const S_TO_NS = 1e9

const _SHA256_INITIAL = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
]
const _SHA256_STATE = [
  0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A,
  0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2,
]
const _SHA256_SCHEDULE = [
  0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA,
  0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6,
  0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33,
  0xD258B060, 0x72766564,
]
const _SHA256_ROUND_CONSTANTS = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
  0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
  0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
  0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
  0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
  0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
  0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
  0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
  0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
]
const _SHA256_ADJUSTMENT = 0xC9DC06A7
const _SHA256_BLOCK_CONSTANTS = [
  ..._SHA256_ROUND_CONSTANTS.slice(0, 14),
  _SHA256_ADJUSTMENT,
  ..._SHA256_ROUND_CONSTANTS.slice(15),
]
const _SHA256_SIGMA0_ADJUSTMENT = 0x059C0B80
const _SHA256_SIGMA1_ADJUSTMENT = 0x000B92C0

const _CS64_COEFFICIENTS = [
  [0xE82E91B1, 0xB32700D0],
  [0x44DE24C6, 0x88DFF51D],
  [0x3BEB65BC, 0x29514038],
  [0xC89C5933, 0xB328CBDF],
  [0x8D1EC211, 0xD405B4D5],
  [0x314EF5D5, 0x26E55F3C],
  [0xE92491B1, 0x607801C6],
  [0xF0A5B9D5, 0x82B2C1FB],
  [0x06064CF3, 0xFA51A3DA],
  [0xDA79FA60, 0x207CC464],
  [0xBED20560, 0x3C3C74F3],
  [0x89F9C9F8, 0xD2D14B61],
  [0x35FA38C6, 0xBB04A2C1],
  [0xCB49E3C6, 0xC5626167],
]
const _CS64_FACTOR = 0x82893933
const _CS64_ADJUSTMENT0 = 0xF2F90B1A
const _CS64_ADJUSTMENT1 = 0x0B1A0000

function rol16(v: number): number {
  return (((v << 16) | (v >>> 16)) >>> 0)
}

function wordsLe4Even(buf: Uint8Array): number[] {
  const padLen = (4 - (buf.length % 4)) % 4
  let padded = buf
  if (padLen > 0) {
    const next = new Uint8Array(buf.length + padLen)
    next.set(buf)
    padded = next
  }
  if (padded.length === 0) return []
  const words: number[] = []
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  for (let i = 0; i < padded.length; i += 4) {
    words.push(view.getUint32(i, true))
  }
  if (words.length % 2 !== 0) words.push(0)
  return words
}

function sigma0(v: number): number {
  return (((v >>> 7) ^ (v << 25) ^ (v >>> 18) ^ (v << 14) ^ (v >>> 3)) >>> 0)
}

function sigma1(v: number): number {
  return (((v >>> 17) ^ (v << 15) ^ (v >>> 19) ^ (v << 13) ^ (v >>> 10)) >>> 0)
}

function sha256Rounds(state: number[], words: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state
  const constants = firstRound === 14 ? _SHA256_BLOCK_CONSTANTS : _SHA256_ROUND_CONSTANTS
  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8)

  for (let idx = firstRound; idx < aligned; idx++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const ch = (e & f) ^ (~e & g)
    const t1 = (h + s1 + ch + constants[idx] + words[idx]) >>> 0
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const maj = (a & b) ^ (a & c) ^ (b & c)
    const t2 = (s0 + maj) >>> 0
    h = g; g = f; f = e; e = (d + t1) >>> 0
    d = c; c = b; b = a; a = (t1 + t2) >>> 0
  }

  for (let idx = aligned; idx < 64; idx++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const ch = (e & f) ^ (~e & g)
    const t1 = (h + s1 + ch + constants[idx] + words[idx]) >>> 0
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const maj = (a & b) ^ (a & c) ^ (b & c)
    const t2 = (s0 + maj) >>> 0
    h = g; g = f; f = e; e = (d + t1) >>> 0
    d = c; c = b; b = a; a = (t1 + t2) >>> 0
  }

  return [a, b, c, d, e, f, g, h]
}

function expandSha256Schedule(words: number[], firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    const x = words[i - 2]
    const y = words[i - 15]
    const s1 = ((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10)
    const s0 = ((y >>> 7) | (y << 25)) ^ ((y >>> 18) | (y << 14)) ^ (y >>> 3)
    words.push((s1 + words[i - 7] + s0 + words[i - 16]) >>> 0)
  }
}

function sha256Init(data: Uint8Array): number[] {
  const words: number[] = new Array(14).fill(0)
  words.push((data[0] << 16) | (data[1] << 8) | data[2])
  words.push((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6])

  for (let i = 16; i < 30; i++) {
    let val = _SHA256_SCHEDULE[i - 16]
    if (i - 2 >= 14) {
      val += i === 16 ? (sigma1(words[i - 2]) ^ _SHA256_SIGMA1_ADJUSTMENT) : sigma1(words[i - 2])
    }
    if (i - 7 >= 14) val += words[i - 7]
    if (i - 15 >= 14) {
      val += i === 29 ? (sigma0(words[i - 15]) ^ _SHA256_SIGMA0_ADJUSTMENT) : sigma0(words[i - 15])
    }
    words.push(val >>> 0)
  }

  words.push(
    (sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + _SHA256_ADJUSTMENT - _SHA256_ROUND_CONSTANTS[14]) >>> 0
  )

  expandSha256Schedule(words, 31)
  const working = sha256Rounds(_SHA256_STATE, words, 14)
  return _SHA256_INITIAL.map((x, idx) => (x + working[idx]) >>> 0)
}

function sha256Digest(data: Uint8Array): Uint8Array {
  const length = 57 + data.length
  const padLen = (55 - length) % 64 >= 0 ? (55 - length) % 64 : ((55 - length) % 64) + 64

  const padded = new Uint8Array(data.length - 7 + 1 + padLen + 8)
  padded.set(data.subarray(7), 0)
  padded[data.length - 7] = 0x80
  const viewLen = new DataView(padded.buffer, padded.byteOffset + padded.length - 8, 8)
  viewLen.setBigUint64(0, BigInt(length * 8), false)

  let state = sha256Init(data.subarray(0, 7))
  const pView = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = []
    for (let j = 0; j < 16; j++) {
      words.push(pView.getUint32(offset + j * 4, false))
    }
    expandSha256Schedule(words)
    const working = sha256Rounds(state, words)
    state = state.map((x, idx) => (x + working[idx]) >>> 0)
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) {
    outView.setUint32(i * 4, state[i], false)
  }
  return out
}

function cs64Digest(data: Uint8Array, digest: Uint8Array): [number, number] {
  const dView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength)
  const keyA = dView.getUint32(0, true) | 1
  const keyB = dView.getUint32(4, true) | 1
  const factors = [
    Math.imul(keyA, _CS64_FACTOR) >>> 0,
    Math.imul(keyB, _CS64_FACTOR) >>> 0,
  ]

  const terms = _CS64_COEFFICIENTS.map(([c], idx) => Math.imul(c, factors[idx % 2]) >>> 0)
  const offsets = _CS64_COEFFICIENTS.map(([, o]) => o >>> 0)

  const combined = new Uint8Array(1 + data.length)
  combined[0] = 0
  combined.set(data, 1)

  const words = wordsLe4Even(combined)
  words.forEach((w, idx) => {
    let term = Math.imul(w, idx % 2 === 0 ? keyA : keyB) >>> 0
    let offset = Math.imul(rol16(w), idx % 2 === 0 ? 0xEF0569FB : 0xC31713DB) >>> 0
    if (idx === 0) {
      term = (term + Math.imul(_CS64_ADJUSTMENT0, factors[0])) >>> 0
      offset = (offset + _CS64_ADJUSTMENT1) >>> 0
    }
    terms.push(term)
    offsets.push(offset)
  })

  let swapAcc = 0, swapLast = 0, state = 0, acc = 0
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i]
    const y = terms[i + 1]
    let t = rol16((offsets[i] + x) >>> 0)
    let q = Math.imul(t, 0x76F50F34) >>> 0
    swapAcc = (swapAcc + Math.imul(rol16(q), 0xC3EFEA97) + q) >>> 0
    t = rol16((offsets[i + 1] + y) >>> 0)
    q = Math.imul(t, 0x1881CE3C) >>> 0
    swapLast = (Math.imul(rol16(q), 0x35BD1EC9) + q) >>> 0
    swapAcc = (swapAcc + swapLast) >>> 0

    state = (Math.imul(state, keyA) + x) >>> 0
    state = Math.imul(rol16(state), 0xCF98B111) >>> 0
    state = Math.imul(rol16(state), 0x87085B9F) >>> 0
    state = Math.imul(rol16(state), 0x12CEB96D) >>> 0
    state = Math.imul(rol16(state), 0x257E1D83) >>> 0
    acc = (acc + state) >>> 0

    t = (Math.imul(state, keyB) + y) >>> 0
    t = Math.imul(rol16(t), 0xA27416F5) >>> 0
    t = Math.imul(rol16(t), 0xD38396FF) >>> 0
    state = Math.imul(rol16(Math.imul(rol16(t), 0x7C932B89) >>> 0), 0xBFA49F69) >>> 0
    acc = (acc + state) >>> 0
  }

  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0]
}

function toHexUpper(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("")
}

export function generateSecMsGecV2(): string {
  const now = Math.floor(Date.now() / 1000)
  let ticks = now + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= S_TO_NS / 100
  const str = new TextEncoder().encode(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`)
  const digest = sha256Digest(str)
  const [csA, csB] = cs64Digest(str, digest)
  const csBuf = new Uint8Array(8)
  const csView = new DataView(csBuf.buffer)
  csView.setUint32(0, csA, true)
  csView.setUint32(4, csB, true)
  return `${toHexUpper(csBuf)}-${toHexUpper(digest)}`
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export interface EdgeTtsOptions {
  voice?: string
  rate?: string
  pitch?: string
  volume?: number
  customEndpoint?: string
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: Error) => void
}

let activeAudio: HTMLAudioElement | null = null
let activeSocket: WebSocket | null = null

export function stopActiveEdgeTts() {
  if (activeSocket) {
    try {
      activeSocket.close()
    } catch {
      // ignore
    }
    activeSocket = null
  }
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.currentTime = 0
    } catch {
      // ignore
    }
    activeAudio = null
  }
}

async function connectEdgeSocket(urls: string[]): Promise<WebSocket> {
  let lastError: Error | null = null
  for (const url of urls) {
    try {
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        let settled = false
        const socket = new WebSocket(url)
        socket.binaryType = "arraybuffer"
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true
            try {
              socket.close()
            } catch {
              // ignore
            }
            reject(new Error("Connection timed out"))
          }
        }, 5000)

        socket.onopen = () => {
          if (!settled) {
            settled = true
            clearTimeout(timeout)
            resolve(socket)
          }
        }
        socket.onerror = () => {
          if (!settled) {
            settled = true
            clearTimeout(timeout)
            reject(new Error("WebSocket open error"))
          }
        }
      })
      return ws
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError || new Error("Failed to connect to Edge TTS endpoint")
}

export async function synthesizeEdgeTts(
  text: string,
  options: EdgeTtsOptions = {},
): Promise<Blob> {
  stopActiveEdgeTts()

  const voice = options.voice || "en-US-AriaNeural"
  const rate = options.rate || "+0%"
  const pitch = options.pitch || "+0Hz"
  const lang = voice.split("-").slice(0, 2).join("-") || "en-US"

  const connectionId = crypto.randomUUID().replace(/-/g, "")
  const secMsGec = generateSecMsGecV2()
  const query = `TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=2-143.0.3650.75&ConnectionId=${connectionId}`

  let candidateUrls: string[] = []
  if (options.customEndpoint?.trim()) {
    const base = options.customEndpoint.trim()
    candidateUrls = [base.includes("?") ? `${base}&${query}` : `${base}?${query}`]
  } else if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    candidateUrls = [
      `${proto}//${window.location.host}/edge-tts-proxy/consumer/speech/synthesize/readaloud/edge/v1?${query}`,
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${query}`,
    ]
  } else {
    candidateUrls = [`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${query}`]
  }

  const socket = await connectEdgeSocket(candidateUrls)
  activeSocket = socket

  return new Promise((resolve, reject) => {
    const audioChunks: ArrayBuffer[] = []
    let completed = false

    const cleanup = () => {
      try {
        socket.close()
      } catch {
        // ignore
      }
      if (activeSocket === socket) {
        activeSocket = null
      }
    }

    const timeoutTimer = setTimeout(() => {
      if (!completed) {
        cleanup()
        reject(new Error("Edge TTS request timed out"))
      }
    }, 15000)

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          completed = true
          clearTimeout(timeoutTimer)
          cleanup()
          if (audioChunks.length === 0) {
            reject(new Error("No audio received from Edge TTS"))
            return
          }
          resolve(new Blob(audioChunks, { type: "audio/mp3" }))
        }
      } else if (event.data instanceof ArrayBuffer) {
        const view = new DataView(event.data)
        if (view.byteLength >= 2) {
          const headerLength = view.getUint16(0)
          if (view.byteLength > 2 + headerLength) {
            audioChunks.push(event.data.slice(2 + headerLength))
          }
        }
      }
    }

    socket.onerror = () => {
      if (!completed) {
        clearTimeout(timeoutTimer)
        cleanup()
        reject(new Error("Edge TTS WebSocket streaming error"))
      }
    }

    socket.onclose = () => {
      if (!completed) {
        clearTimeout(timeoutTimer)
        if (audioChunks.length > 0) {
          completed = true
          resolve(new Blob(audioChunks, { type: "audio/mp3" }))
        } else {
          reject(new Error("Edge TTS connection closed unexpectedly"))
        }
      }
    }

    // Send speech configuration message
    const configMsg =
      `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
      JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false",
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      })
    socket.send(configMsg)

    // Send SSML speech request
    const reqId = crypto.randomUUID().replace(/-/g, "")
    const dateStr = new Date().toUTCString()
    const escapedText = escapeXml(text)
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
      `<voice name="${voice}">` +
      `<prosody pitch="${pitch}" rate="${rate}">` +
      `${escapedText}` +
      `</prosody>` +
      `</voice>` +
      `</speak>`

    const ssmlMsg =
      `X-RequestId:${reqId}\r\n` +
      `Content-Type:application/ssml+xml\r\n` +
      `X-Timestamp:${dateStr}Z\r\n` +
      `Path:ssml\r\n\r\n` +
      ssml
    socket.send(ssmlMsg)
  })
}

export async function playEdgeTts(
  text: string,
  options: EdgeTtsOptions = {},
): Promise<HTMLAudioElement> {
  const blob = await synthesizeEdgeTts(text, options)
  const audioUrl = URL.createObjectURL(blob)
  const audio = new Audio(audioUrl)
  activeAudio = audio

  if (typeof options.volume === "number") {
    audio.volume = Math.max(0, Math.min(1, options.volume))
  }

  audio.onplay = () => {
    options.onStart?.()
  }

  audio.onended = () => {
    URL.revokeObjectURL(audioUrl)
    if (activeAudio === audio) {
      activeAudio = null
    }
    options.onEnd?.()
  }

  audio.onerror = () => {
    URL.revokeObjectURL(audioUrl)
    if (activeAudio === audio) {
      activeAudio = null
    }
    options.onError?.(new Error("Audio playback error"))
  }

  await audio.play()
  return audio
}
