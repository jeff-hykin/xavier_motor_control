#!/usr/bin/env -S deno run --allow-all
import { getPorts, open, Serial } from "https://esm.sh/gh/jeff-hykin/deno_serial@e5a73c3/mod.ts"

// -- config --
const PORT = "/dev/ttyTHS0"
const UART_BAUD_RATE = 57600
const SERIAL_TIMEOUT_MS = 0.1
const MAGIC_NUMBER = 0xdeadbeef

// Size of fields in bytes
const STRUCT_SIZES = {
    magic: 4,
    checksum: 1,
    which_motor: 1,
    power: 1,
    uart_rate: 4,
}

// Helper: pack uint32 LE
function uint32ToLE(buf: Uint8Array, offset: number, v: number) {
    buf[offset + 0] = v & 0xff
    buf[offset + 1] = (v >>> 8) & 0xff
    buf[offset + 2] = (v >>> 16) & 0xff
    buf[offset + 3] = (v >>> 24) & 0xff
}

// Helper: pack int8
function int8To(buf: Uint8Array, offset: number, v: number) {
    buf[offset] = v & 0xff
}

// Build MessageToEmbedded buffer
function buildMessageToEmbedded(which_motor: number, power: number, uart_send_rate_ms = Math.floor((1 / 60) * 1000)): Uint8Array {
    const size = STRUCT_SIZES.magic + STRUCT_SIZES.checksum + STRUCT_SIZES.which_motor + STRUCT_SIZES.power + STRUCT_SIZES.uart_rate
    const buf = new Uint8Array(size)
    let ptr = 0

    // magic number
    uint32ToLE(buf, ptr, MAGIC_NUMBER)
    ptr += STRUCT_SIZES.magic

    // placeholder checksum
    buf[ptr] = 0
    ptr += STRUCT_SIZES.checksum

    // which_motor
    if (which_motor < 0 || which_motor > 3) {
        throw new Error("which_motor must be 0–3")
    }
    int8To(buf, ptr, which_motor)
    ptr += STRUCT_SIZES.which_motor

    // power
    if (power < -128 || power > 128) {
        throw new Error("power must be –128 to 128")
    }
    int8To(buf, ptr, power)
    ptr += STRUCT_SIZES.power

    // uart_send_rate_ms
    if (uart_send_rate_ms < 0) {
        throw new Error("uart_send_rate_ms must be >=0")
    }
    uint32ToLE(buf, ptr, uart_send_rate_ms)
    // ptr += STRUCT_SIZES.uart_rate;

    // compute checksum: sum all bytes after magic+checksum
    const sumStart = STRUCT_SIZES.magic + STRUCT_SIZES.checksum
    let cs = 0
    for (let i = sumStart; i < buf.length; i++) {
        cs = (cs + buf[i]) & 0xff
    }
    buf[STRUCT_SIZES.magic] = cs // put checksum

    return buf
}

// Parser for UartMessageFromMotor
async function readAndParseMotorMessage(port: Serial): Promise<void> {
    // total struct size:
    const motorCount = 4
    // fields: corruption(1) + for each motor: u32 + u8 + float + i16 + i16 + u8 + u32
    const per = 1 + 4 + 1 + 4 + 2 + 2 + 1 + 4 // =19
    const totalSize = per * motorCount + 1 // extra initial byte
    const raw = await port.read(totalSize)
    if (!raw || raw.length !== totalSize) return

    const dv = new DataView(raw.buffer)
    const corruption = dv.getUint8(0)
    if (corruption > 0) {
        console.error(`DATA CORRUPTION DETECTED: ${corruption}. Consider lowering baud rate or check hardware.`)
    }

    const out = []
    let offset = 1
    const BASE_CAN = 517
    for (let mi = 0; mi < motorCount; mi++) {
        const can_id = dv.getUint32(offset, true)
        offset += 4
        const can_dlc = dv.getUint8(offset)
        offset += 1
        const angle = dv.getFloat32(offset, true)
        offset += 4
        const rpm = dv.getInt16(offset, true)
        offset += 2
        const discharge = dv.getInt16(offset, true)
        offset += 2
        const temp = dv.getUint8(offset)
        offset += 1
        const timestamp = dv.getUint32(offset, true)
        offset += 4

        if (can_id === BASE_CAN + mi) {
            out.push({
                motor: mi,
                angle,
                rpm,
                temp,
                timestamp,
            })
        }
    }
    if (out.length) {
        console.log("✅ Got motor data:", out)
    }
}

async function main() {
    const ports = await getPorts()
    if (ports.length === 0) {
        console.error("No serial ports found!")
        return
    }
    // console.log("Ports:", ports)

    const port = await open({
        name: PORT,
        baudRate: UART_BAUD_RATE,
        timeout: SERIAL_TIMEOUT_MS,
    })

    let lastSent = performance.now() - 1e6

    while (true) {
        const now = performance.now()
        if (now - lastSent > 200) {
            console.log("now - lastSent",now - lastSent)
            const msg = buildMessageToEmbedded(1, 7, 1000)
            console.log(`msg is:`,msg)
            await port.write(msg)
            lastSent = now
        }

        await readAndParseMotorMessage(port)

        // delay ~200 ms
        await new Promise((res) => setTimeout(res, 200))
    }
}

main().catch(console.error)
