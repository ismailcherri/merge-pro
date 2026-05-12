// One-shot placeholder icon generator. Run: node scripts/make-icon.cjs
// Produces a 128x128 PNG at assets/icon.png — solid brown (#3C2F2F) with
// a cream "MP" wordmark stamped via a hand-coded 5x7 bitmap font.
// Replace with a real icon before public marketing.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const W = 128
const H = 128
const BG = [0x3c, 0x2f, 0x2f]
const FG = [0xe8, 0xd5, 0xc4]

// 5x7 bitmap font for M and P only (1 = fg, 0 = bg).
const GLYPHS = {
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
}

// Render at a large scale so the wordmark is readable at 128x128.
const SCALE = 10 // 5*10 = 50 px wide per glyph; 7*10 = 70 px tall
const GLYPH_W = 5 * SCALE
const GLYPH_H = 7 * SCALE
const GAP = 8
const TEXT_W = GLYPH_W * 2 + GAP
const TEXT_H = GLYPH_H
const ORIGIN_X = Math.floor((W - TEXT_W) / 2)
const ORIGIN_Y = Math.floor((H - TEXT_H) / 2)

const pixels = Buffer.alloc(W * H * 3)
for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = BG[0]
    pixels[i + 1] = BG[1]
    pixels[i + 2] = BG[2]
}

function paintGlyph(glyph, ox) {
    for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
            if (glyph[gy][gx] !== '1') continue
            for (let dy = 0; dy < SCALE; dy++) {
                for (let dx = 0; dx < SCALE; dx++) {
                    const px = ox + gx * SCALE + dx
                    const py = ORIGIN_Y + gy * SCALE + dy
                    const off = (py * W + px) * 3
                    pixels[off] = FG[0]
                    pixels[off + 1] = FG[1]
                    pixels[off + 2] = FG[2]
                }
            }
        }
    }
}

paintGlyph(GLYPHS.M, ORIGIN_X)
paintGlyph(GLYPHS.P, ORIGIN_X + GLYPH_W + GAP)

// PNG encode: filter byte (0) at the start of each scanline.
const raw = Buffer.alloc(H * (1 + W * 3))
for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0
    pixels.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3)
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
    }
    return t
})()
function crc32(buf) {
    let c = 0xffffffff
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const tp = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.concat([tp, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(crcBuf), 0)
    return Buffer.concat([len, tp, data, crc])
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // color type: RGB
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace
const idat = zlib.deflateSync(raw)
const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
])

const outPath = path.join(__dirname, '..', 'assets', 'icon.png')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, png)
console.log('Wrote', outPath, png.length, 'bytes')
