#!/usr/bin/env -S deno run --allow-all
import { getPorts, open, Serial } from "https://esm.sh/gh/jeff-hykin/deno_serial@e5a73c3/mod.ts"
import { sum } from "https://esm.sh/gh/jeff-hykin/good-js@1.17.2.0/source/flattened/sum.js"
import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.4/main/file_system.js"
import Yaml from 'https://esm.sh/yaml@2.4.3'

// -- config --
const PORT = "/dev/ttyTHS0"
const UART_BAUD_RATE = 57600
const SERIAL_TIMEOUT_MS = 0.1
const MAGIC_NUMBER = 0xdeadbeef

// Size of fields in bytes
const MESSAGE_TO_EMBEDDED_SIZES = {
    magic: 4,
    checksum: 1,
    whichMotor: 1,
    power: 1,
    uart_rate: 4,
}

const MESSAGE_FROM_EMBEDDED_SIZES = {
    canbus_id: 4, //uint32_t
    can_dlc: 1, //uint8_t
    angle: 4, //float
    rpm: 2, //int16_t
    discharge_rate: 2, //int16_t
    temperature: 1, //uint8_t
    timestamp: 4, //uint32_t
}
const MESSAGE_FROM_EMBEDDED_TOTAL_SIZE = sum(Object.values(MESSAGE_FROM_EMBEDDED_SIZES))
const MOTOR_COUNT = 4

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
let prevMessage
function buildMessageToEmbedded(whichMotor: number, power: number, uartSendRateMs = null) {
    const size = MESSAGE_TO_EMBEDDED_SIZES.magic + MESSAGE_TO_EMBEDDED_SIZES.checksum + MESSAGE_TO_EMBEDDED_SIZES.whichMotor + MESSAGE_TO_EMBEDDED_SIZES.power + MESSAGE_TO_EMBEDDED_SIZES.uart_rate
    const buf = new Uint8Array(size)
    let ptr = 0

    // magic number
    uint32ToLE(buf, ptr, MAGIC_NUMBER)
    ptr += MESSAGE_TO_EMBEDDED_SIZES.magic

    // placeholder checksum
    buf[ptr] = 0
    ptr += MESSAGE_TO_EMBEDDED_SIZES.checksum

    // whichMotor
    if (whichMotor < 0 || whichMotor > 3) {
        throw new Error("whichMotor must be 0–3")
    }
    int8To(buf, ptr, whichMotor)
    ptr += MESSAGE_TO_EMBEDDED_SIZES.whichMotor

    // power
    if (power < -128 || power > 128) {
        throw new Error("power must be –128 to 128")
    }
    int8To(buf, ptr, power)
    ptr += MESSAGE_TO_EMBEDDED_SIZES.power

    // uartSendRateMs
    uartSendRateMs = uartSendRateMs ?? buildMessageToEmbedded.defaultSendRate
    if (uartSendRateMs < 0) {
        throw new Error("uartSendRateMs must be >=0")
    }
    uint32ToLE(buf, ptr, uartSendRateMs)
    // ptr += MESSAGE_TO_EMBEDDED_SIZES.uart_rate;

    // compute checksum: sum all bytes after magic+checksum
    const sumStart = MESSAGE_TO_EMBEDDED_SIZES.magic + MESSAGE_TO_EMBEDDED_SIZES.checksum
    let cs = 0
    for (let i = sumStart; i < buf.length; i++) {
        cs = (cs + buf[i]) & 0xff
    }
    buf[MESSAGE_TO_EMBEDDED_SIZES.magic] = cs // put checksum
    
    prevMessage = buf // for heartbeat system
    return buf
}
buildMessageToEmbedded.defaultSendRate = Math.floor((1 / 30) * 1000)

// Parser for UartMessageFromMotor
async function readAndParseMotorMessage(port: Serial) {
    // fields: corruption(1) + for each motor: u32 + u8 + float + i16 + i16 + u8 + u32
    const totalSize = MESSAGE_FROM_EMBEDDED_TOTAL_SIZE * MOTOR_COUNT + 1 // extra initial byte
    const raw = await port.read(totalSize)
    if (!raw || raw.length !== totalSize) {
        return
    }

    const dv = new DataView(raw.buffer)
    const corruption = dv.getUint8(0)
    if (corruption > 0) {
        console.error(`motorMessages CORRUPTION DETECTED: (rating: ${corruption}). Possibly consider lowering baud rate or check hardware if this is frequent.`)
    }

    const out = []
    let offset = 1
    const BASE_CAN = 517
    for (let mi = 0; mi < MOTOR_COUNT; mi++) {
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
    return out
}
const yawMotorId = 0
const pitchMotorId = 1
let motorMessages = [
    [ "motor", "angle", "rpm", "temp", "timestamp", ] // header
]


let prevTime
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

    //
    // heartbeat system
    //
    // this is VITAL for non-slipring systems (systems that can't spin all the way around)
    // this makes sure the embedded board gets a message at least once every half second
    // if it doesn't, then it will stop all motor movement because it assumes the program crashed
    ;((async ()=>{
        while (true) {
            await new Promise((res) => setTimeout(res, 400))
            if (prevMessage) {
                await port.write(prevMessage)
            }
        }
    })())

    let lastSent = performance.now() - 1e6
    
    //
    // record responses
    //
    const logPath = `${FileSystem.thisFolder}/motor_logs.ignore.yaml`
    // clear old
    await FileSystem.write({path:logPath, data: "", overwrite: true})
    ;((async ()=>{
        let count = 0
        while (true) {
            const motorMessage = await readAndParseMotorMessage(port)
            if (!motorMessage) {
                continue
            }
            const now = performance.now()
            if (prevTime) {
                const duration = now - prevTime
                // console.debug(`duration is:`,duration) // usually around 36ms
                // buildMessageToEmbedded.defaultSendRate = duration*0.8
            }
            prevTime = now
            motorMessages.push(...(motorMessage).map(Object.values))
            // 53,0,239 // yaw valid range
            // 253,345 // valid pitch range
            // 
            // saftey check
            // 
                // yaw valid locations
                    // 35
                    // 16
                    // 0
                // immedately stop the motor from going outside the range
                const yawAngle = motorMessage[yawMotorId].angle
                const yawIsValid = yawAngle > 253 || yawAngle < 35
                if (!yawIsValid) {
                    console.log(`yaw outside of range! ${yawAngle}`)
                    await port.write(buildMessageToEmbedded(yawMotorId, 0))
                }
                const pitchInValidRange = (motorMessage[pitchMotorId].angle > 0 && motorMessage[pitchMotorId].angle < 53) ||
                                        (motorMessage[pitchMotorId].angle > 239 && motorMessage[pitchMotorId].angle < 360)
                if (!pitchInValidRange) {
                    // immedately stop the motor from going outside the range
                    console.log(`pitch outside of range! ${motorMessage[pitchMotorId].angle}`)
                    await port.write(buildMessageToEmbedded(pitchMotorId, 0))
                }
            // 
            // data recording
            // 
            if (motorMessage) {
                if (count++ % 10 == 0) { // bulk write
                    FileSystem.append({path:logPath, data: "- "+motorMessages.map(JSON.stringify).join("\n- ")+"\n", overwrite: true}).catch(console.error)
                    motorMessages.length = 0
                }
            }
        }
    })())

    // set the send rate
    await port.write(buildMessageToEmbedded(0, 0,))

    //
    // pitch movements
    //
    let timeScale = 0.2
    ;((async ()=>{
        // while (true) {
        //     await port.write(buildMessageToEmbedded(pitchMotorId, 7))
        //     await new Promise((res) => setTimeout(res, timeScale*1000))
        //     await port.write(buildMessageToEmbedded(pitchMotorId, 7))
        //     await new Promise((res) => setTimeout(res, timeScale*1000))
        //     await port.write(buildMessageToEmbedded(pitchMotorId, 0))
            
        //     await new Promise((res) => setTimeout(res, 1000))
            
        //     await port.write(buildMessageToEmbedded(pitchMotorId, -7))
        //     await new Promise((res) => setTimeout(res, timeScale*1000))
        //     await port.write(buildMessageToEmbedded(pitchMotorId, 0))
            
        //     await new Promise((res) => setTimeout(res, 1000))

        //     // await port.write(buildMessageToEmbedded(pitchMotorId, 15))
        //     // await new Promise((res) => setTimeout(res, timeScale*500))
        //     // await port.write(buildMessageToEmbedded(pitchMotorId, 0))
            
        //     // await new Promise((res) => setTimeout(res, 1000))
            
        //     // await port.write(buildMessageToEmbedded(pitchMotorId, -15))
        //     // await new Promise((res) => setTimeout(res, timeScale*500))
        //     // await port.write(buildMessageToEmbedded(pitchMotorId, 0))
        //     // await new Promise((res) => setTimeout(res, 1000))
        // }
    })())
    
    //
    // yaw movements
    //
    ;((async ()=>{
        // const now = performance.now()
        // if (now - lastSent > 200) {
        //     console.log("now - lastSent", now - lastSent)
        //     console.log(`msg is:`, msg)
        //     lastSent = now
        // }
        while (true) {
            await port.write(buildMessageToEmbedded(yawMotorId, 7))
            await new Promise((res) => setTimeout(res, timeScale*1000))
            await port.write(buildMessageToEmbedded(yawMotorId, 0))
            
            await new Promise((res) => setTimeout(res, 1000))
            
            await port.write(buildMessageToEmbedded(yawMotorId, -7))
            await new Promise((res) => setTimeout(res, timeScale*1000))
            await port.write(buildMessageToEmbedded(yawMotorId, 0))
            
            // await new Promise((res) => setTimeout(res, 1000))
            // await port.write(buildMessageToEmbedded(yawMotorId, 15))
            // await new Promise((res) => setTimeout(res, timeScale*500))
            // await port.write(buildMessageToEmbedded(yawMotorId, 0))
            
            // await new Promise((res) => setTimeout(res, 1000))
            
            // await port.write(buildMessageToEmbedded(yawMotorId, -15))
            // await new Promise((res) => setTimeout(res, timeScale*500))
            // await port.write(buildMessageToEmbedded(yawMotorId, 0))
            await new Promise((res) => setTimeout(res, 1000))
            
            // extral delay to desync movements
            // await new Promise((res) => setTimeout(res, Math.random()*1000))
        }
    })())
}

main().catch(console.error)
