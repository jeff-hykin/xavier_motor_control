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
    // FIXME: make sure git installed
    // FIXME: make sure project uses git
    // FIXME: check for any unstaged changes
    // TODO: eventually use wasm-git instead of a system tool

// 
// main code
// 
    let { repo, branch, tag, commit, help } = {
        repo: Deno.args[0],
        branch: null,
        tag: null,
        commit: null,
        ...parse(Deno.args),
    }
    // go to the root before starting
    FileSystem.pwd = virkshop.pathTo.project

    if (help || Deno.args.length == 0) {
        console.log(`
            examples usages:
                virkshop/mixin \\
                    --repo git@github.com:jeff-hykin/virkshop.git \\
                    --branch master
                
                virkshop/mixin \\
                    --repo git@github.com:jeff-hykin/virkshop.git \\
                    --tag v1.1.0
                
                virkshop/mixin \\
                    --repo git@github.com:jeff-hykin/virkshop.git \\
                    --branch master
                    --commit affa05c6928247fe4e4453f6514ff777b2543842
                
                virkshop/mixin \\
                    --repo git@github.com:jeff-hykin/virkshop.git \\
                    --branch master \\
                    --commit affa05c6928247fe4e4453f6514ff777b2543842
        `.replace(/^            /g, ""))
        Deno.exit(0)
    }
    
    // tags and branches are basically the same thing
    branch = branch || tag || "master"
    
    console.log("Just FYI you may need to handle a git merge in a moment")
    
    // ignore result
    await run`git remote remove ${"@__temp__"} ${Out(null)}`
    var {success} = await run`git remote add ${"@__temp__"} ${repo}`.outcome
    var {success} = success && await run`git fetch ${"@__temp__"} ${branch}`
    if (commit) {
        var {success} = success && await run`git cherry-pick ${commit}`
    } else {
        var {success} = success && await run`git pull --allow-unrelated-histories ${"@__temp__"} ${branch}`
    }
    // clean up leftovers
    await run`git remote remove ${"@__temp__"} ${Out(null)}`

    if (success) {
        await virkshop.trigger("@upon_mixing")
    }
// (this comment is part of deno-guillotine, dont remove) #>