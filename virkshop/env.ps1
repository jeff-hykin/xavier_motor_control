#!/usr/bin/env sh
"\"",`$(echo --% ' |echo "1.41.3"; : --% ' |out-null)" >$null;function :{};function dv{<#${/*'>/dev/null )` 2>/dev/null;dv() { #>
echo "1.41.3"; : --% ' |out-null|echo "1.41.3"; : --% ' |out-null <#'; }; version="$(dv)"; deno="$HOME/.deno/$version/bin/deno"; if [ -x "$deno" ]; then  exec "$deno" run -q -A --no-lock --no-config "$0" "$@";  elif [ -f "$deno" ]; then  chmod +x "$deno" && exec "$deno" run -q -A --no-lock --no-config "$0" "$@";  fi; bin_dir="$HOME/.deno/$version/bin"; exe="$bin_dir/deno"; has () { command -v "$1" >/dev/null; } ;  if ! has unzip; then if ! has apt-get; then  has brew && brew install unzip; else  if [ "$(whoami)" = "root" ]; then  apt-get install unzip -y; elif has sudo; then  echo "Can I install unzip for you? (its required for this command to work) ";read ANSWER;echo;  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "yes" ] || [ "$ANSWER" = "Y" ]; then  sudo apt-get install unzip -y; fi; elif has doas; then  echo "Can I install unzip for you? (its required for this command to work) ";read ANSWER;echo;  if [ "$ANSWER" = "y" ] || [ "$ANSWER" = "yes" ] || [ "$ANSWER" = "Y" ]; then  doas apt-get install unzip -y; fi; fi;  fi;  fi;  if ! has unzip; then  echo ""; echo "So I couldn't find an 'unzip' command"; echo "And I tried to auto install it, but it seems that failed"; echo "(This script needs unzip and either curl or wget)"; echo "Please install the unzip command manually then re-run this script"; exit 1;  fi;  repo="denoland/deno"; if [ "$OS" = "Windows_NT" ]; then target="x86_64-pc-windows-msvc"; else :;  case $(uname -sm) in "Darwin x86_64") target="x86_64-apple-darwin" ;; "Darwin arm64") target="aarch64-apple-darwin" ;; "Linux aarch64") repo="LukeChannings/deno-arm64" target="linux-arm64" ;; "Linux armhf") echo "deno sadly doesn't support 32-bit ARM. Please check your hardware and possibly install a 64-bit operating system." exit 1 ;; *) target="x86_64-unknown-linux-gnu" ;; esac; fi; deno_uri="https://github.com/$repo/releases/download/v$version/deno-$target.zip"; exe="$bin_dir/deno"; if [ ! -d "$bin_dir" ]; then mkdir -p "$bin_dir"; fi;  if ! curl --fail --location --progress-bar --output "$exe.zip" "$deno_uri"; then if ! wget --output-document="$exe.zip" "$deno_uri"; then echo "Howdy! I looked for the 'curl' and for 'wget' commands but I didn't see either of them. Please install one of them, otherwise I have no way to install the missing deno version needed to run this code"; exit 1; fi; fi; unzip -d "$bin_dir" -o "$exe.zip"; chmod +x "$exe"; rm "$exe.zip"; exec "$deno" run -q -A --no-lock --no-config "$0" "$@"; #>}; $DenoInstall = "${HOME}/.deno/$(dv)"; $BinDir = "$DenoInstall/bin"; $DenoExe = "$BinDir/deno.exe"; if (-not(Test-Path -Path "$DenoExe" -PathType Leaf)) { $DenoZip = "$BinDir/deno.zip"; $DenoUri = "https://github.com/denoland/deno/releases/download/v$(dv)/deno-x86_64-pc-windows-msvc.zip";  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;  if (!(Test-Path $BinDir)) { New-Item $BinDir -ItemType Directory | echo "1.41.3"; : --% ' |out-null; };  Function Test-CommandExists { Param ($command); $oldPreference = $ErrorActionPreference; $ErrorActionPreference = "stop"; try {if(Get-Command "$command"){RETURN $true}} Catch {Write-Host "$command does not exist"; RETURN $false}; Finally {$ErrorActionPreference=$oldPreference}; };  if (Test-CommandExists curl) { curl -Lo $DenoZip $DenoUri; } else { curl.exe -Lo $DenoZip $DenoUri; };  if (Test-CommandExists curl) { tar xf $DenoZip -C $BinDir; } else { tar -Lo $DenoZip $DenoUri; };  Remove-Item $DenoZip;  $User = [EnvironmentVariableTarget]::User; $Path = [Environment]::GetEnvironmentVariable('Path', $User); if (!(";$Path;".ToLower() -like "*;$BinDir;*".ToLower())) { [Environment]::SetEnvironmentVariable('Path', "$Path;$BinDir", $User); $Env:Path += ";$BinDir"; } }; & "$DenoExe" run -q -A --no-lock --no-config "$PSCommandPath" @args; Exit $LastExitCode; <# 
# */0}`;

import { FileSystem } from "https://deno.land/x/quickr@0.6.38/main/file_system.js"
import { Console, cyan, blue } from "https://deno.land/x/quickr@0.6.38/main/console.js"
import { virkshop } from "./support/virkshop.js"
import { Args } from "./support/parse_args.js"
import { recursivelyAllKeysOf, get, set, remove, merge, compareProperty } from "https://deno.land/x/good@0.7.8/object.js"

const executableName = "virkshop/env"
const args = new Args({
    argList: Deno.args,
    boolean: [ "help", "as_absolute_path" ],
    string: [
        "overwriteAs",
        "envVar",
        "prepend",
        "joinUsing",
    ],
    default: { help: false, },
})

// FIXME: --help option

const systemToolsFolder = FileSystem.normalize(FileSystem.parentPath(virkshop.pathTo.systemTools))
const asAbsolutePath = args.namedArgs.as_absolute_path
const handleAbsolutePathOption = async (value, name)=>{
    if (asAbsolutePath) {
        if (FileSystem.isRelativePath(value)) {
            // assume it is relative to the current PWD
            // make relative to systemToolsFolder
            value = FileSystem.makeRelativePath({
                from: systemToolsFolder,
                to: `${FileSystem.pwd}/${value}` 
            })
            const absolutePath = FileSystem.normalize( `${systemToolsFolder}/${value}`)
            const absolutePathInfo = await FileSystem.info(absolutePath)
            if (!absolutePathInfo.exists) {
                console.warn(`
                    
                    WARNING:
                        The --${name} ${JSON.stringify(value)} --as_absolute_path
                        becomes the following path, which currently doesn't exist:
                            ${JSON.stringify(absolutePath)}
                        
                        If that is the correct final path, you can ignore this warning
                    
                `.replace(/\n                    /g, "\n"))
            }
        }
    }
    return value
}
const handleOnlyIf = ()=>{
    if (args.namedArgs.onlyIf) {
        // TODO: do a var sanity check (parse the yaml, see if the variable name actually exists)
        return `onlyIf: !!var ${JSON.stringify(args.namedArgs.onlyIf)}\n`
    } else {
        return ``
    }
}

const showHelp = ()=>{
    console.log(`
        Note:
            Camel case is used for named args
            Snake case is used for boolean flags

            ${cyan`--as_absolute_path`} allows the info.yaml to contain a relative path
            (good for commits) while still making the path absolute when entering
            the virkshop.

            ${cyan`--onlyIf`} option only works with variable names that set up in the
            system_tools.yaml file. Open up that file to see if something like 
            "isMac" is defined there.
        
        Examples:
            # overwrite
            virkshop/env ${cyan("--envVar")} HISTSIZE ${cyan("--overwriteAs")} '10000'
            virkshop/env ${cyan("--envVar")} LANG     ${cyan("--overwriteAs")} 'en_US.UTF-8'
            virkshop/env ${cyan("--envVar")} TERM     ${cyan("--overwriteAs")} 'xterm-256color' ${cyan(`--onlyIf`)} 'isMac'
            
            # append
            virkshop/env ${cyan("--envVar")} PATH ${cyan("--append")} '/usr/bin' ${cyan("--joinUsing")} ':'
            virkshop/env ${cyan("--envVar")} PATH ${cyan("--append")} '/usr/bin' ${cyan("--joinUsing")} ':' ${cyan(`--onlyIf`)} 'isLinux'
            virkshop/env ${cyan("--envVar")} PATH ${cyan("--append")} './bin' ${blue("--as_absolute_path")} ${cyan("--joinUsing")} ':'

            # prepend
            virkshop/env ${cyan("--envVar")} PYTHONPATH ${cyan("--prepend")} './src' ${blue("--as_absolute_path")} ${cyan("--joinUsing")} ':'

    `.replace(/\n        /g,"\n"))
}

if (args.includesAllNames("help")) {
    showHelp()
} else if (args.includesAllNames("envVar", "overwriteAs")) {
    args.namedArgs.overwriteAs = handleAbsolutePathOption(args.namedArgs.overwriteAs, "overwriteAs")
    
    await FileSystem.append({
        path: virkshop.pathTo.systemTools,
        data: `\n
            - (environmentVariable):
                envVar: ${JSON.stringify(args.namedArgs.envVar)}
                overwriteAs: ${!asAbsolutePath?"":"!!as_absolute_path "}${JSON.stringify(args.namedArgs.overwriteAs)}
                ${handleOnlyIf()}
        `.replace(/\n            /g,"\n"),
    })
    console.log(`done`)
} else if (args.includesAllNames("envVar", "prepend")) {
    args.namedArgs.prepend = handleAbsolutePathOption(args.namedArgs.prepend, "prepend")
    await FileSystem.append({
        path: virkshop.pathTo.systemTools,
        data: `\n
            - (environmentVariable):
                envVar: ${JSON.stringify(args.namedArgs.envVar)}
                prepend: ${!asAbsolutePath?"":"!!as_absolute_path "}${JSON.stringify(args.namedArgs.prepend)}
                joinUsing: ${JSON.stringify(args.namedArgs.joinUsing || "")}
                ${handleOnlyIf()}
        `.replace(/\n            /g,"\n"),
    })
    console.log(`done`)
} else if (args.includesAllNames("envVar", "append")) {
    args.namedArgs.append = handleAbsolutePathOption(args.namedArgs.append, "append")
    await FileSystem.append({
        path: virkshop.pathTo.systemTools,
        data: `\n
            - (environmentVariable):
                envVar: ${JSON.stringify(args.namedArgs.envVar)}
                append: ${!asAbsolutePath?"":"!!as_absolute_path "}${JSON.stringify(args.namedArgs.append)}
                joinUsing: ${JSON.stringify(args.namedArgs.joinUsing || "")}
        `.replace(/\n            /g,"\n"),
    })
    console.log(`done`)
} else {
    showHelp()
    Deno.exit(1)
}
// (this comment is part of deno-guillotine, dont remove) #>