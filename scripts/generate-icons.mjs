// Generates PNG app icons (no dependencies) from simple geometry matching public/icon.svg.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BLUE = [37, 99, 235]
const WHITE = [255, 255, 255]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

// distance from point to segment
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax,
    dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// colour of a point in 512-space
function sample(x, y) {
  const inCircle = Math.hypot(x - 256, y - 200) <= 122
  // tapered tip: triangle from circle sides down to (256, 432)
  const tipT = (y - 200) / (432 - 200)
  const inTip = y >= 200 && y <= 432 && Math.abs(x - 256) <= 122 * (1 - tipT) ** 1.15
  if (!(inCircle || inTip)) return BLUE
  if (Math.hypot(x - 256, y - 200) <= 62) {
    const d = Math.min(segDist(x, y, 230, 202, 249, 221), segDist(x, y, 249, 221, 286, 180))
    return d <= 8 ? WHITE : BLUE
  }
  return WHITE
}

function png(size) {
  const SS = 3
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(((x + (sx + 0.5) / SS) / size) * 512, ((y + (sy + 0.5) / SS) / size) * 512)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r / (SS * SS)
      raw[o + 1] = g / (SS * SS)
      raw[o + 2] = b / (SS * SS)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size))
  console.log('wrote', name)
}
