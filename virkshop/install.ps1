#!/usr/bin/env sh
"\"",`$(echo --% ' |echo "1.41.3"; : --% ' |out-null)" >$null;function :{};function dv{<#${/*'>/dev/null )` 2>/dev/null;dv() { #>
echo "1.41.3"; : --% ' |out-null|echo "1.41.3"; : --% ' |out-null <#'; }; version="$(dv)"; deno="$HOME/.deno/$version/bin/deno"; if [ -x "$deno" ]; then  exec "$deno" run -q -A --no-lock --no-config "$0" "$@";  elif [ -f "$deno" ]; then  chmod +x "$deno" && exec "$deno" run -q -A --no-lock --no-config "$0" "$@";  fi; bin_dir="$HOME/.deno/$version/bin"; exe="$bin_dir/deno"; has () { command -v "$1" >/dev/null; } ;  if ! has unzip; then if ! has apt-get; then  has brew && brew install unzip; else  if [ "$(whoami)" = "root" ]; then  apt-get install unzip -y; elif has sudo; then  echo "Can I install unzip for you? (its required for this command to work) ";read ANSWER;echo;  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "yes" ] || [ "$ANSWER" = "Y" ]; then  sudo apt-get install unzip -y; fi; elif has doas; then  echo "Can I install unzip for you? (its required for this command to work) ";read ANSWER;echo;  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "yes" ] || [ "$ANSWER" = "Y" ]; then  doas apt-get install unzip -y; fi; fi;  fi;  fi;  if ! has unzip; then  echo ""; echo "So I couldn't find an 'unzip' command"; echo "And I tried to auto install it, but it seems that failed"; echo "(This script needs unzip and either curl or wget)"; echo "Please install the unzip command manually then re-run this script"; exit 1;  fi;  repo="denoland/deno"; if [ "$OS" = "Windows_NT" ]; then target="x86_64-pc-windows-msvc"; else :;  case $(uname -sm) in "Darwin x86_64") target="x86_64-apple-darwin" ;; "Darwin arm64") target="aarch64-apple-darwin" ;; "Linux aarch64") repo="LukeChannings/deno-arm64" target="linux-arm64" ;; "Linux armhf") echo "deno sadly doesn't support 32-bit ARM. Please check your hardware and possibly install a 64-bit operating system." exit 1 ;; *) target="x86_64-unknown-linux-gnu" ;; esac; fi; deno_uri="https://github.com/$repo/releases/download/v$version/deno-$target.zip"; exe="$bin_dir/deno"; if [ ! -d "$bin_dir" ]; then mkdir -p "$bin_dir"; fi;  if ! curl --fail --location --progress-bar --output "$exe.zip" "$deno_uri"; then if ! wget --output-document="$exe.zip" "$deno_uri"; then echo "Howdy! I looked for the 'curl' and for 'wget' commands but I didn't see either of them. Please install one of them, otherwise I have no way to install the missing deno version needed to run this code"; exit 1; fi; fi; unzip -d "$bin_dir" -o "$exe.zip"; chmod +x "$exe"; rm "$exe.zip"; exec "$deno" run -q -A --no-lock --no-config "$0" "$@"; #>}; $DenoInstall = "${HOME}/.deno/$(dv)"; $BinDir = "$DenoInstall/bin"; $DenoExe = "$BinDir/deno.exe"; if (-not(Test-Path -Path "$DenoExe" -PathType Leaf)) { $DenoZip = "$BinDir/deno.zip"; $DenoUri = "https://github.com/denoland/deno/releases/download/v$(dv)/deno-x86_64-pc-windows-msvc.zip";  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;  if (!(Test-Path $BinDir)) { New-Item $BinDir -ItemType Directory | echo "1.41.3"; : --% ' |out-null; };  Function Test-CommandExists { Param ($command); $oldPreference = $ErrorActionPreference; $ErrorActionPreference = "stop"; try {if(Get-Command "$command"){RETURN $true}} Catch {Write-Host "$command does not exist"; RETURN $false}; Finally {$ErrorActionPreference=$oldPreference}; };  if (Test-CommandExists curl) { curl -Lo $DenoZip $DenoUri; } else { curl.exe -Lo $DenoZip $DenoUri; };  if (Test-CommandExists curl) { tar xf $DenoZip -C $BinDir; } else { tar -Lo $DenoZip $DenoUri; };  Remove-Item $DenoZip;  $User = [EnvironmentVariableTarget]::User; $Path = [Environment]::GetEnvironmentVariable('Path', $User); if (!(";$Path;".ToLower() -like "*;$BinDir;*".ToLower())) { [Environment]::SetEnvironmentVariable('Path', "$Path;$BinDir", $User); $Env:Path += ";$BinDir"; } }; & "$DenoExe" run -q -A --no-lock --no-config "$PSCommandPath" @args; Exit $LastExitCode; <# 
# */0}`;

import { OperatingSystem } from "https://deno.land/x/quickr@0.6.28/main/operating_system.js"
import { FileSystem } from "https://deno.land/x/quickr@0.6.28/main/file_system.js"
import { run, hasCommand, throwIfFails, zipInto, mergeInto, returnAsString, Timeout, Env, Cwd, Stdin, Stdout, Stderr, Out, Overwrite, AppendTo } from "https://deno.land/x/quickr@0.6.28/main/run.js"
import { Console, black, white, red, green, blue, yellow, cyan, magenta, lightBlack, lightWhite, lightRed, lightGreen, lightBlue, lightYellow, lightMagenta, lightCyan, blackBackground, whiteBackground, redBackground, greenBackground, blueBackground, yellowBackground, magentaBackground, cyanBackground, lightBlackBackground, lightRedBackground, lightGreenBackground, lightYellowBackground, lightBlueBackground, lightMagentaBackground, lightCyanBackground, lightWhiteBackground, bold, reset, dim, italic, underline, inverse, strikethrough, gray, grey, lightGray, lightGrey, grayBackground, greyBackground, lightGrayBackground, lightGreyBackground, } from "https://deno.land/x/quickr@0.6.28/main/console.js"
import { move as moveAndRename } from "https://deno.land/std@0.133.0/fs/mod.ts"
import * as Path from "https://deno.land/std@0.128.0/path/mod.ts"
import { zip } from "https://deno.land/x/good@1.1.0.0/array.js"
import { virkshop, parsePackageTools } from "./support/virkshop.js"
import { nix } from "./support/specific_tools/nix_tools.js"
import { parse } from "https://deno.land/std@0.171.0/flags/mod.ts"

// 
// start some async ops
// 
    // schedule file read
    const currentSystemToolsPromise = parsePackageTools(virkshop.pathTo.systemTools)

// 
// pre-check
// 
    await nix.ensureInstalled()

// 
// main code
// 
    let { packageName, from, help } = {
        packageName: Deno.args[0],
        ...parse(Deno.args),
    }

    if (help || Deno.args.length == 0) {
        console.log(`
            examples usages:
                virkshop/install python3
                virkshop/install python3 --from warehouseWithTorch_1_8_1
        `.replace(/^            /g, ""))
        Deno.exit(0)
    }

    // 
    // pick warehouse
    // 
    const currentSystemTools = await currentSystemToolsPromise
    const relativePathToSystemTools = FileSystem.makeRelativePath({from: FileSystem.pwd, to: virkshop.pathTo.systemTools})
    let warehouseTarFileUrl = currentSystemTools.defaultWarehouse.createWarehouseFrom.tarFileUrl
    const warehouses = Object.fromEntries(currentSystemTools.warehouses.map(each=>[each.saveAs, each])) 
    if (from) {
        if (!warehouses[from]) {
            console.error(`\n\nI was given --from ${from}\nHowever, when looking at ${relativePathToSystemTools} I didn't see that warehouse. I only see these: \n    ${Object.keys(warehouses).join("\n    ")}\n`)
        } else {
            // extract out the tar file URL
            warehouseTarFileUrl = warehouses[from].createWarehouseFrom.tarFileUrl
        }
    }
    
    // 
    // check if package already installed
    // 
    console.log()
    const packageAttributeStrings = currentSystemTools.directPackages.map(each=>each.load.join("."))
    if (packageAttributeStrings.includes(packageName)) {
        // TODO: could improve this message, e.g. "Did you want to install a different version?"
        console.log(`It looks like ${packageName} is already inside ${relativePathToSystemTools}`)
        if (! await Console.askFor.yesNo(`\nDo you want to add it anyways?`)) {
            console.log(`Okay`)
            Deno.exit(1)
        }
        console.log(`Okay`)
    }

    // 
    // search + install steps
    // 
    console.log(`... searching ${from||"defaultWarehouse"}, getting a response from nix can take a minute ...`)
    const currentPlatform = await run(
        "nix",
        "eval",
        "--extra-experimental-features", "nix-command",
        "--impure",
        "--raw",
        "--expr",
        `
            (builtins.import 
                (builtins.fetchTarball
                    ({url=${nix.escapeJsValue(warehouseTarFileUrl)};})
                )
                ({})
            ).stdenv.system
        `,
        Stdout(returnAsString)
    )
    const resultString =  await run('nix-env', '-qa', packageName, "--json", "--system-filter", currentPlatform, "-f", warehouseTarFileUrl, Stdout(returnAsString))
    if (resultString) {
        const results = JSON.parse(resultString)
        const packageAttributeNames = Object.entries(results).map(([key, value])=>key.replace(/^nixpkgs\.(.+)/,"$1"))
        const packageCommonNames = Object.entries(results).map(([key, value])=>value.pname)
        const packageVersions = Object.entries(results).map(([key, value])=>value.version)
        if (packageAttributeNames.includes(packageName)) {
            const index = packageAttributeNames.indexOf(packageName)
            const version = packageVersions[index]
            console.log(`... found exact match`)
            if (version) {
                console.log(`... version: ${version}`)
            }
            const versionComment = version ? `\n    # version at time of install: ${version}` : ""
            await FileSystem.write({
                path: virkshop.pathTo.systemTools,
                data: currentSystemTools.asString+`
                    
                    - (package):${versionComment}
                        asBuildInput: true
                        load: [ ${JSON.stringify(packageName)},]
                `.replace(/\n                    /g, "\n"),
            })
            console.log(`Package successfully added to ${relativePathToSystemTools}`)
        } else {
            console.log(`Here are some similar names, re-run with one of them (e.g. virkshop/install ${packageAttributeNames[0]})`)
            const namePadding    = Math.max(...packageAttributeNames.map(each=>each.length))
            const versionPadding = Math.max(...packageVersions.map(each=>`${each}`.length))
            for (const [ attribute, commonlyCalled, version ] of zip(packageAttributeNames, packageCommonNames, packageVersions)) {
                console.log(`    ${attribute.padEnd(namePadding)} (version:${version.padEnd(versionPadding)}, commonlyCalled:${commonlyCalled})`)
            }
        }
        Deno.exit(0)
    }
    console.log("Sorry I don't see that package :/")
    
    // {
    // "nixpkgs.firefox-esr": {
    //     "name": "firefox-102.3.0esr",
    //     "pname": "firefox",
    //     "version": "102.3.0esr",
    //     "system": "aarch64-darwin",
    //     "outputName": "out",
    //     "outputs": {
    //     "out": null
    //     }
    // },
    // "nixpkgs.firefox-esr-wayland": {
    //     "name": "firefox-102.3.0esr",
    //     "pname": "firefox",
    //     "version": "102.3.0esr",
    //     "system": "aarch64-darwin",
    //     "outputName": "out",
    //     "outputs": {
    //     "out": null
    //     }
    // },
    // "nixpkgs.firefox": {
    //     "name": "firefox-105.0.3",
    //     "pname": "firefox",
    //     "version": "105.0.3",
    //     "system": "aarch64-darwin",
    //     "outputName": "out",
    //     "outputs": {
    //     "out": null
    //     }
    // },
    // "nixpkgs.firefox-wayland": {
    //     "name": "firefox-105.0.3",
    //     "pname": "firefox",
    //     "version": "105.0.3",
    //     "system": "aarch64-darwin",
    //     "outputName": "out",
    //     "outputs": {
    //     "out": null
    //     }
    // }
    // }
// (this comment is part of deno-guillotine, dont remove) #>