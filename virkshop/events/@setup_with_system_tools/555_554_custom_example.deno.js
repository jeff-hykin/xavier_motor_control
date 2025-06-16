
// uncomment to show the zsh version
import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.1/main/file_system.js"
import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
const $$ = (...args)=>$(...args).noThrow()
// await $$`false`
// (await $$`false`).code
// await $$`false`.text("stderr")
// await $$`false`.text("combined")
// await $$`echo`.stdinText("yes\n")

if (!FileSystem.sync.info(`.venv`).isFolder) {
    await $$`python -m venv .venv`
    await $$`python -m pip install lbuild==1.21.6`
}