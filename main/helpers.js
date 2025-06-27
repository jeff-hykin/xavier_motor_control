import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.4/main/file_system.js"
// import { getPorts, open } from "https://esm.sh/gh/jeff-hykin/deno_serial@0.0.2.0/mod.ts";
import { getPorts, open } from "https://esm.sh/gh/jeff-hykin/deno_serial@4c1f56f/mod.ts";
import { Select } from "https://esm.sh/@jsr/cliffy__prompt@1.0.0-rc.7/select.ts"
// patch to work with Deno 1.x
if (!Deno.stdin.isTerminal) {
    Deno.stdin.isTerminal = ()=>true
}

import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
export const $$ = (...args)=>$(...args).noThrow()
export { Select, FileSystem, open as openPort }

// 
// helper 
// 
export async function userSelectPortPath() {
    const ports = await getPorts()
    let possibleArduinoPorts = ports||[]
    let whichPort = null
    if (ports.length === 0) {
        throw Error(`\nI don't see any ports. Is everything plugged in?\n`)
    } else if (ports.length !== 1) {
        whichPort = await Select.prompt({
            message: "Which port should be listened to? (pick one)",
            // list: true,
            // info: true,
            // completeOnSubmit: true,
            options: ports.map(each=>each.name),
        })
    } else {
        whichPort = ports[0].name
    }
    return whichPort
}

export async function userSelectArduinoPortPath() {
    const ports = await getPorts()
    let possibleArduinoPorts = ports||[]
    if (ports) {
        if (Deno.build.os === "linux") {
            // only look at USB ports
            possibleArduinoPorts = ports.filter(each=>each.name.startsWith("/dev/ttyACM"))
        } else if (Deno.build.os === "darwin") {
            // only look at USB ports
            possibleArduinoPorts = ports.filter(each=>each.name.startsWith("/dev/tty.usbmodem"))
        }
    }
    let whichPort = null
    if (possibleArduinoPorts.length === 0) {
        throw Error(`\n\nHere's the ports I see:\n    ${JSON.stringify(ports.map(each=>each.name))}\n\nPROBLEM: I didn't see any USB ports in there.\nIs the arduino plugged in?\n`)
    } else if (possibleArduinoPorts.length !== 1) {
        whichPort = await Select.prompt({
            message: "Which port should be listened to? (pick one)",
            // list: true,
            // info: true,
            // completeOnSubmit: true,
            options: possibleArduinoPorts.map(each=>each.name),
        })
    } else {
        whichPort = ports[0].name
    }
    return whichPort
}

// 
// setup
// 
export const projectFolderOrNull = await FileSystem.walkUpUntil({
    subPath:"virkshop",
    startPath: FileSystem.thisFolder,
})
if (projectFolderOrNull === null) {
    throw Error("Couldn't find project folder")
}

// (this comment is part of deno-guillotine, dont remove) #>