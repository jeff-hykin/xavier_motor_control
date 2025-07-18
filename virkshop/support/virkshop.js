import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.1/main/file_system.js"
import { Console, black, white, red, green, blue, yellow, cyan, magenta, lightBlack, lightWhite, lightRed, lightGreen, lightBlue, lightYellow, lightMagenta, lightCyan, blackBackground, whiteBackground, redBackground, greenBackground, blueBackground, yellowBackground, magentaBackground, cyanBackground, lightBlackBackground, lightRedBackground, lightGreenBackground, lightYellowBackground, lightBlueBackground, lightMagentaBackground, lightCyanBackground, lightWhiteBackground, bold, reset, dim, italic, underline, inverse, strikethrough, gray, grey, lightGray, lightGrey, grayBackground, greyBackground, lightGrayBackground, lightGreyBackground, } from "https://deno.land/x/quickr@0.8.1/main/console.js"
import { indent, findAll, escapeRegexMatch, escapeRegexReplace, } from "https://deno.land/x/good@0.7.18/string.js"
import { hashers } from "https://deno.land/x/good@0.7.18/encryption.js"
import { move as moveAndRename } from "https://deno.land/std@0.133.0/fs/mod.ts"
import { Type } from "https://deno.land/std@0.82.0/encoding/_yaml/type.ts"
import * as yaml from "https://deno.land/std@0.82.0/encoding/yaml.ts"
// import { nix } from "./specific_tools/nix_tools.js"
import { numberPrefixRenameList } from "./specific_tools/number_prefix_rename_list.js"
import { readExtendedYaml, parsePackageTools, systemToolsToNix } from "./specific_tools/read_extended_yaml.js"
import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
const $$ = (...args)=>$(...args).noThrow()
// await $$`false`
// await $$`false`.text("stderr")
const denoFlags = `--allow-all --no-lock --quiet`
const posixShellEscape = (string)=>"'"+string.replace(/'/g, `'"'"'`)+"'"

// 
// 
// Main
// 
// 
let debuggingLevel = false
const thisFile = FileSystem.thisFile
const virkshopIdentifierPath = `support/virkshop.js` // The only thing that can basically never change
const originalPathVar = Console.env.PATH
const coreWarehouse = "https://github.com/NixOS/nixpkgs/archive/f1b9cc23aa8b1549dd7cb53dbe9fc950efc97646.tar.gz"
export const createVirkshop = async (arg)=>{
    var { virkshopPath, projectPath } = {...arg}
    virkshopPath = virkshopPath || Console.env.VIRKSHOP_FOLDER         // env var is used when already inside of the virkshop
    projectPath  = projectPath  || Console.env.PROJECT_FOLDER // env var is used when already inside of the virkshop

    const realHome = Console.env.VIRKSHOP_USERS_HOME || Console.env.HOME
    
    // 
    // auto-detect a virkshop path
    // 
    if (!virkshopPath) {
        const walkUpPath = await FileSystem.walkUpUntil(virkshopIdentifierPath, FileSystem.pathOfCaller())
        if (walkUpPath) {
            virkshopPath = walkUpPath
        // fallback case, caller must be in project, try looking for top level virkshop
        } else {
            projectPath = projectPath || FileSystem.pwd
            // try the most common place
            const defaultPlaceInfo = await FileSystem.info(`${projectPath}/virkshop/${virkshopIdentifierPath}`)
            if (defaultPlaceInfo.isFolder) {
                virkshopPath = defaultPlaceInfo
            } else {
                // time to brute force search for it
                const virkshopPaths = []
                const iterator = FileSystem.recursivelyIteratePathsIn(
                    projectPath,
                    {
                        searchOrder: 'breadthFirstSearch',
                        maxDepth: 2, // TODO: this may change in the future
                    },
                )
                for await (const eachPath of iterator) {
                    const eachInfo = await FileSystem.info(`${eachPath}/${virkshopIdentifierPath}`)
                    if (eachInfo.isFolder) {
                        virkshopPaths.push(eachInfo.path)
                    }
                }
                if (virkshopPaths.length == 1) {
                    virkshopPath = virkshopPaths[0]
                } else if (virkshopPaths.length >= 2) {
                    // TODO: although I want to give a warning here, if I did then there would be no way to get rid of it
                    // (beacuse the default virkshop object is always created first, and would throw an error before they get a chance to create their own)
                    return Error(`\n\n(This is the virkshop library speaking)\nI'm unable to load using the default methods because it seems there is more than one virkshop folder in the project.\nTo specify which one to use do\n    import { createVirkshop } from "..."\n    createVirkshop({ virkshopPath: "WHICH_FOLDER_HERE", projectPath: "" })\nAnd then specify which of the ones you want to use inside ${FileSystem.pathOfCaller()}\n`)
                } else if (virkshopPaths.length == 0) {
                    return Error(`\n\n(This is the virkshop library speaking)\nI'm unable to load using the default methods because I couldn't find any virkshop folders in the project.\nTo specify which one to use do\n    import { createVirkshop } from "..."\n    createVirkshop({ virkshopPath: "WHICH_FOLDER_HERE", projectPath: "" })\nAnd then specify which of the ones you want to use inside ${FileSystem.pathOfCaller()}\n`)
                }
            }
        }
    }
    
    const virkshopCache = {}
    const virkshop = Object.defineProperties(
        {
            version: [1,0,0,],
            settings: {}, // this is not valid until after phase1
            pathTo: Object.defineProperties(
                {
                    realHome,
                    virkshop: virkshopPath,
                    virkshopCommand: `${FileSystem.parentPath(virkshopPath)}/virkshop_command`,
                    project: FileSystem.makeAbsolutePath(projectPath || FileSystem.parentPath(virkshopPath)),
                },
                {
                    events:           { get() { return `${virkshop.pathTo.virkshop}/events` }},
                    commands:         { get() { return `${virkshop.pathTo.virkshop}/commands` }},
                    plugins:          { get() { return `${virkshop.pathTo.virkshop}/plugins` }}, 
                    injections:       { get() { return `${virkshop.pathTo.temporary}/long_term/injections` }}, 
                    settings:         { get() { return `${virkshop.pathTo.virkshop}/settings` }},
                    temporary:        { get() { return `${virkshop.pathTo.virkshop}/temporary.ignore` }},
                    homeMixin:        { get() { return `${virkshop.pathTo.virkshop}/home` }},
                    fakeHome:         { get() { return `${virkshop.pathTo.temporary}/long_term/home` }},
                    virkshopOptions:  { get() { return `${virkshop.pathTo.virkshop}/settings.yaml` }},
                    systemTools:      { get() { return `${virkshop.pathTo.virkshop}/system_tools.yaml` }},
                    _tempNixShellFile:{ get() { return `${virkshop.pathTo.fakeHome}/shell.nix` }},
                }
            ),
            coreWarehouse, 
            get shellApi() {
                return shellApi
            },
            _internal: {
                importedPlugins: {},
                homeMappingPriorities: [],
                shellSetupPriorities: [],
                finalShellCode: "",
                deadlines: {
                    beforeSetup: [],
                    beforeReadingSystemTools: [],
                    beforeShellScripts: [],
                    beforeEnteringVirkshop: [],
                },
                sortPrioitiesByPath(array, convert=each=>each) {
                    array.sort((each1, each2) => convert(each1).localeCompare(convert(each2)))
                },
                async pathToUserCommand(commandName) {
                    const shellPath = Console.env.SHELL
                    if (shellPath) {
                        let shell = FileSystem.basename(shellPath)
                        if (shell == "bash" || shell == "zsh" || shell == "dash" || shell == "ash" || shell == "sh") {
                            const path = await $$`${shellPath} -c ${`command -v ${posixShellEscape(commandName)}`}`.text("stdout")
                            if (path.length == 0) {
                                return null
                            }
                            return path
                        }
                    }
                    
                    // if user has a more complicated runtime, fallback on sh and hope that its posix
                    const path = await $$`sh -c ${`command -v ${posixShellEscape(commandName)}`}`.text("stdout")
                    if (path.length == 0) {
                        return null
                    }
                    return path
                },
                createApi({ source, eventName, deadlineName }) {
                    return {
                        ...virkshop,
                        source,
                        eventName,
                        addToShellProfile(string) {
                            if (deadlineName == "beforeEnteringVirkshop") {
                                throw Error(`
                                    There is a virkshop.addToShellProfile() inside a ${deadlineName}()
                                    In this file: ${this.source}
                                    
                                    The problem:
                                        The shell profile will already be done by the time of ${deadlineName}
                                    
                                    Likely solution:
                                        Change ${deadlineName}() to beforeShellScripts()
                                        Note: the available deadlines are:
                                            beforeSetup, beforeReadingSystemTools, beforeShellScripts, beforeEnteringVirkshop
                                `.replace(/\n                                /g,"\n"))
                            }
                            
                            virkshop._internal.shellSetupPriorities.push([ this.source, string ])
                        },
                        setEnvVar(name, value) {
                            if (deadlineName == "beforeEnteringVirkshop") {
                                throw Error(`
                                    There is a virkshop.setEnvVar() inside a ${deadlineName}()
                                    In this file: ${this.source}
                                    
                                    The problem:
                                        The shell profile will already be done by the time of ${deadlineName}
                                    
                                    Likely solution:
                                        Change ${deadlineName}() to beforeShellScripts()
                                        Note: the available deadlines are:
                                            beforeSetup, beforeReadingSystemTools, beforeShellScripts, beforeEnteringVirkshop
                                `.replace(/\n                                /g,"\n"))
                            }
                            
                            virkshop._internal.shellSetupPriorities.push([ this.source, `${name}=${shellApi.escapeShellArgument(value)}` ])
                        },
                        injectUsersCommand(commandName) {
                            virkshop._internal.deadlines.beforeEnteringVirkshop.push(((async ()=>{
                                const pathThatIsHopefullyGitIgnored = `${virkshop.pathTo.injections}/${commandName}`
                                const commandPath = `${virkshop.pathTo.commands}/${commandName}`
                                
                                await FileSystem.ensureIsFile(pathThatIsHopefullyGitIgnored)
                                
                                try {
                                    await FileSystem.remove(commandPath)
                                    await FileSystem.relativeLink({
                                        existingItem: pathThatIsHopefullyGitIgnored,
                                        newItem: commandPath,
                                        overwrite: true,
                                        force: true,
                                    })
                                } catch (error) {
                                    console.error(error)
                                }
                                
                                // Note: this command is intentionally never awaited because it only needs to be done by the time nix-shell starts, which takes multiple orders of magnitude more time (not awaiting lets it be done in parallel)
                                virkshop._internal.pathToUserCommand(commandName).then(async (absolutePathToCommand)=>{
                                    if (absolutePathToCommand) {
                                        await FileSystem.write({
                                            path: pathThatIsHopefullyGitIgnored,
                                            data: `#!/usr/bin/env sh\n# NOTE: this command was auto-generated and is just a wrapper around the user's ${commandName.replace(/\n/,"")}\n`+`HOME=${shellApi.escapeShellArgument(virkshop.pathTo.realHome)} PATH=${shellApi.escapeShellArgument(originalPathVar)} ${absolutePathToCommand} "$@"`.replace(/\n/g, ""),
                                            overwrite: true,
                                        })
                                        await FileSystem.addPermissions({path: pathThatIsHopefullyGitIgnored, permissions: { owner: {canExecute: true} }})
                                    } else {
                                        await FileSystem.remove(pathThatIsHopefullyGitIgnored)
                                    }
                                })
                            })()))
                        },
                        linkRealHomeFolder(path) {
                            virkshop._internal.homeMappingPriorities.push({
                                relativePathFromHome: path,
                                target: FileSystem.makeAbsolutePath(`${virkshop.pathTo.realHome}/${path}`),
                                targetIsFile: false, // TODO: add a check/warning if home-thing exists and disagrees
                                source,
                            })
                        },
                        linkRealHomeFile(path) {
                            virkshop._internal.homeMappingPriorities.push({
                                relativePathFromHome: path,
                                target: FileSystem.makeAbsolutePath(`${virkshop.pathTo.realHome}/${path}`),
                                targetIsFile: true, // TODO: add a check/warning if home-thing exists and disagrees
                                source,
                            })
                        },
                    }
                },
                async fixupEventPathNumbers() {
                    const paths = await FileSystem.listFilePathsIn(virkshop.pathTo.events)
                    const pathsThatNeedRenaming = numberPrefixRenameList(paths)
                    const promises = []
                    for (const { oldPath, newPath } of pathsThatNeedRenaming) {
                        promises.push(moveAndRename(oldPath, newPath))
                    }
                    await Promise.all(promises)
                },
                async importPlugin(pluginPath) {
                    if (virkshop.options.debuggingLevel > 1) {
                        console.log(`    importing plugin: ${pluginPath}`)
                    }
                    // convert URLs to paths so that _importPlugin(import.meta.url) works without additional logic
                    if (pluginPath.startsWith("file://")) {
                        const {pathname} = new URL(pluginPath)
                        // from: https://deno.land/std@0.191.0/path/posix.ts?source#L459
                        pluginPath = decodeURIComponent(pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"))
                    }
                    const id = FileSystem.isRelativePath(pluginPath) ? pluginPath : FileSystem.makeRelativePath({ from: virkshop.pathTo.plugins, to: pluginPath })
                    if (virkshop._internal.importedPlugins[id]) {
                        return virkshop._internal.importedPlugins[id]
                    }
                    const pluginImport = await import(`${encodeURIComponent(`${virkshop.pathTo.plugins}/${pluginPath}`).replace(/%2F/g,'/')}`)
                    const pluginFunction = pluginImport.default
                    
                    const valuesKey = Symbol("values")
                    const directKey = valuesKey
                    const createColdStorageAndOneTimeDo = async (name) => {
                        const storagePath = `${virkshop.pathTo.temporary}/${name}/cold_storage/${id}.json`
                        let values
                        // 
                        // init values
                        // 
                            try {
                                values = JSON.parse(
                                    await FileSystem.read(storagePath)
                                )
                            } catch (error) {
                                const storagePathInfo = await FileSystem.info(storagePath)
                                if (storagePathInfo.isFile) {
                                    console.warn(`\n\nSeems a cold storage path was corrupted (${JSON.stringify(storagePath)}). It will be wiped out to start fresh\n`)
                                }
                                values = {}
                            }
                        // 
                        // storage
                        // 
                        const storageManager = {
                            [valuesKey]: values,
                            get path() {
                                return storagePath
                            },
                            get(key, _direct) {
                                if (_direct === directKey) {
                                    return values[key]
                                } else {
                                    return values[`@${key}`]
                                }
                            },
                            set(key, value, _direct) {
                                if (_direct === directKey) {
                                    values[key] = value
                                } else {
                                    values[`@${key}`] = value
                                }
                                // no await because it assumes this runtime is the only one touching the cold storage
                                FileSystem.write({
                                    data: JSON.stringify(
                                        values,
                                        0,
                                        virkshop.options.debuggingLevel > 1 ? 4 : 0, // have indent when debuggingLevel > 1
                                    ),
                                    path: storagePath,
                                }).catch(async (error)=>{
                                    if (virkshop.options.debuggingLevel > 0) {
                                        console.warn(error)
                                    }
                                    FileSystem.write({data:"{}", path: storagePath})
                                })
                            },
                        }

                        // 
                        // doOneTime
                        // 
                        async function doOneTime(func) {
                            const key = "doOneTime:"+await hashers.sha256(func.toString())
                            if (!storageManager.get(key, directKey)) {
                                try {
                                    await func()
                                    // only set true if completed without error
                                    storageManager.set(key, true, directKey)
                                } catch (error) {
                                    console.error(error)
                                }
                            }
                        }

                        return [
                            storageManager,
                            doOneTime,
                        ]
                    }
                    const [ shortTermColdStorage, shortTermDoOneTime ] = await createColdStorageAndOneTimeDo("short_term")
                    const [ longTermColdStorage, longTermDoOneTime ] = await createColdStorageAndOneTimeDo("long_term")
                    const pluginArgs = {
                        id,
                        virkshop,
                        pluginSettings: (virkshop.options?.plugins||{})[id] || {},
                        shellApi,
                        helpers: {
                            shortTermColdStorage,
                            longTermColdStorage,
                            shortTermDoOneTime,
                            longTermDoOneTime,
                            changeChecker: async function({
                                checkName,
                                whenChanged,
                                whenNoChange=()=>0,
                                filePaths=[],
                                values=[],
                                executeOnFirstTime=true,
                                useLongTermStorage=false,
                            }) {
                                const checkId = `${id}:${checkName}`
                                const storage = useLongTermStorage ? longTermColdStorage : shortTermColdStorage
                                const oldCheckSum = storage.get(checkId)
                                const isFirstExecution = !oldCheckSum
                                let saveNewCheckSum = true
                                const newCheckSum = await hashers.sha256(
                                    JSON.stringify(
                                        await Promise.all([
                                            ...filePaths.map(each=>FileSystem.read(each).then(hashers.sha256)),
                                            ...values,
                                        ])
                                    )
                                )
                                const whenChangedWrapper = async ()=>{
                                    try {
                                        await whenChanged()
                                    } catch (error) {
                                        saveNewCheckSum = false
                                        console.log(`        [check: ${checkId}] whenChanged threw an error: ${error}`)
                                    }
                                }
                                
                                // 
                                // no change
                                // 
                                if (newCheckSum === oldCheckSum) {
                                    try {
                                        await whenNoChange()
                                    } catch (error) {
                                        console.log(`        [check: ${checkId}] whenNoChange threw an error: ${error}`)
                                    }
                                // 
                                // change
                                // 
                                } else {
                                    if (!isFirstExecution) {
                                        await whenChangedWrapper()
                                    // if first time
                                    } else {
                                        if (executeOnFirstTime) {
                                            await whenChangedWrapper()
                                        }
                                    }
                                }
                                
                                // 
                                // save newCheckSum if no error
                                // 
                                if (saveNewCheckSum) {
                                    storage.set(checkId, newCheckSum)
                                }
                            },
                        },
                    }
                    const pluginOutput = await pluginFunction(pluginArgs)
                    // 
                    // bind all the functions
                    // 
                    for (const eachCategory of [ "commands", "events", "methods" ]) {
                        for (const [key, value] of Object.entries(pluginOutput[eachCategory]||{})) {
                            if (value instanceof Function) {
                                pluginOutput[eachCategory][key] = value.bind(pluginOutput)
                            }
                        }
                    }
                    // final output
                    return virkshop._internal.importedPlugins[id] = {
                        pluginOutput,
                        ...pluginArgs,
                    }
                },
                async setupPlugin(pluginPath) {
                    // FIXME: do an Object.freeze on plugins, and then catch the default error to explain why properties cant be edited
                    if (virkshop.options.debuggingLevel > 1) {
                        console.log(`    setting up plugin: ${pluginPath}`)
                    }
                    // FIXME: restrict what a valid plugin id can be
                    // FIXME: auto-delete things that used to be autogenerated but are not anymore
                        // for commands: FIXME
                        // for event hooks: done
                    const { pluginOutput, id, } = await virkshop._internal.importPlugin(pluginPath)
                    const relativePluginPath = FileSystem.makeRelativePath({
                        from: virkshop.pathTo.project,
                        to: `${virkshop.pathTo.plugins}/${id}`,
                    })

                    // 
                    // auto-generate commands
                    // 
                        // FIXME: make commands link as a means of identifying which are autogenerated
                        const absolutePathToDeno = Deno.execPath()
                        virkshop._internal.deadlines.beforeShellScripts.push(
                            Promise.all(Object.keys(pluginOutput?.commands||{}).map(async (commandName)=>{
                                const executablePath = `${virkshop.pathTo.commands}/${commandName}`
                                await FileSystem.write({
                                    // FIXME: check that the command doesn't already exist
                                    path: executablePath,
                                    data: [
                                        `#!/usr/bin/env -S ${posixShellEscape(absolutePathToDeno)} run ${denoFlags}`,
                                        `// NOTE: this file was auto-generated by: ${JSON.stringify(relativePluginPath)}`,
                                        `//       edit that file, not this one!`,
                                        `import { virkshop } from ${JSON.stringify(FileSystem.makeRelativePath({ from: virkshop.pathTo.commands, to: thisFile }))}`,
                                        `await (await virkshop._internal.importPlugin(${JSON.stringify(pluginPath)})).pluginOutput.commands[${JSON.stringify(commandName)}](Deno.args)`,
                                    ].join("\n")
                                })
                                await FileSystem.addPermissions({path: executablePath, permissions: { owner: {canExecute: true} }})
                            }))
                        )
                    // 
                    // events
                    // 

                        const eventNames = Object.keys(pluginOutput?.events||{})
                        // 
                        // @setup_without_system_tools (deadline hooks)
                        // 
                            // create placeholder files
                            const withoutSystemToolsListenerNames = eventNames.filter(each=>each.startsWith("@setup_without_system_tools/"))
                            // very unimportant, just needs to be done sometime, so put it at the bottom of the event scheduler
                            setTimeout(async () => {
                                for (const eventName of withoutSystemToolsListenerNames) {
                                    const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated.deno.js}`
                                    try {
                                        await FileSystem.write({
                                            path: eventPath,
                                            data: `// this file was autogenerated as a placeholder by the "@setup_without_system_tools" inside of\n// ${JSON.stringify(relativePluginPath)}\n// edit that file^ instead of this one`,
                                        })
                                    } catch (error) {
                                        console.error(`error creating placeholder for ${relativePath}:${eventName}`, error)
                                    }
                                }
                            }, 100)
                            // connect all of the deadlines
                            await Promise.all(
                                withoutSystemToolsListenerNames.map(
                                    async (eventName)=>{
                                        try {
                                            const deadlineResponses = await pluginOutput.events[eventName]()
                                            for (const [deadlineName, deadlineHook] of Object.entries(deadlineResponses)) {
                                                if (!(virkshop._internal.deadlines[deadlineName] instanceof Array)) {
                                                    console.error(`         [plugin:${JSON.stringify(relativePluginPath)}] the ${JSON.stringify(eventName)} event hook`)
                                                    console.error(`             returned ${deadlineName}, which is not one of the deadlines: ${JSON.stringify(Object.keys(virkshop._internal.deadlines))}`)
                                                } else {
                                                    virkshop._internal.deadlines[deadlineName].push(
                                                        deadlineHook.apply(pluginOutput, virkshop)
                                                    )
                                                }
                                            }
                                        } catch (error) {
                                            console.error(`         [plugin:${JSON.stringify(relativePluginPath)}] hit an error on ${JSON.stringify(eventName)}:`, error)
                                        }
                                    }
                                )
                            )


                        // 
                        // @setup_with_system_tools
                        // 
                            const withSystemToolsListenerNames = eventNames.filter(each=>each.startsWith("@setup_with_system_tools/"))
                            for (const eventName of withSystemToolsListenerNames) {
                                const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated${shellApi.fileExtensions[0]}`
                                const tempShellOutputPath = `${virkshop.pathTo.temporary}/short_term/event_evals/${`${Math.random()}.sh`.replace(/\./,"")}`
                                virkshop._internal.deadlines.beforeShellScripts.push(
                                    FileSystem.write({
                                        path: eventPath,
                                        data: shellApi.joinStatements([
                                            shellApi.lineComment(`this was autogenerated by: ${JSON.stringify(relativePluginPath)}`),
                                            shellApi.lineComment(`all its doing is importing that javascript^, running a specific function from it, and then shell-sourcing the string output`),
                                            shellApi.callCommand(
                                                Deno.execPath(),
                                                "eval",
                                                ...denoFlags.split(" "),
                                                `
                                                    import { FileSystem } from "https://deno.land/x/quickr@0.8.1/main/file_system.js"
                                                    const [ virkshopFile, tempShellOutputPath, pluginPath ] = Deno.args
                                                    const { virkshop, shellApi } = await import(virkshopFile)
                                                    const { pluginOutput } = await virkshop._internal.importPlugin(pluginPath)
                                                    const result = await pluginOutput.events[${JSON.stringify(eventName)}].apply(pluginOutput)
                                                    const shellString = shellApi.joinStatements((result||[]))
                                                    await FileSystem.write({
                                                        data: shellString,
                                                        path: tempShellOutputPath,
                                                    })
                                                `,
                                                "--",
                                                `${virkshop.pathTo.virkshop}/support/virkshop.js`,
                                                tempShellOutputPath,
                                                pluginPath
                                            ),
                                            // source the resulting output file
                                            shellApi.callCommand(".", tempShellOutputPath),
                                        ])
                                    })
                                )
                            }
                        
                        // 
                        // auto-generate custom event hooks
                        // 
                            // very unimportant, just needs to be done sometime, so put it at the bottom of the event scheduler
                            // this is because custom events cant run (or at least arent supported) during startup
                            setTimeout(async () => {
                                const nonBuiltinEventNames = eventNames.filter(each=>!each.startsWith("@"))
                                for (const eventName of nonBuiltinEventNames) {
                                    const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated.deno.js`
                                    try {
                                        await FileSystem.write({
                                            path: eventPath,
                                            data: [
                                                `#!/usr/bin/env -S ${posixShellEscape(absolutePathToDeno)} run ${denoFlags}`,
                                                `// NOTE: this file was auto-generated by: ${JSON.stringify(relativePluginPath)}`,
                                                `//       edit that file, not this one!`,
                                                `import { virkshop } from ${JSON.stringify(FileSystem.makeRelativePath({ from: virkshop.pathTo.commands, to: thisFile }))}`,
                                                `const {pluginOutput} = await virkshop._internal.importPlugin(${JSON.stringify(pluginPath)})`,
                                                `await pluginOutput.events[${JSON.stringify(eventName)}].apply(pluginOutput, ...Deno.args)`,
                                            ].join("\n")
                                        })
                                    } catch (error) {
                                        console.error(`error creating custom hook for ${relativePath}:${eventName}`, error)
                                    }
                                }
                            }, 100)
                },
            },
            _stages: {
                // 
                // 
                // phase 0: "prep" creates/discovers basic virkshop structure (establish linked files/folders, clean broken links)
                // 
                // 
                async phase0() {
                    debuggingLevel && console.log("[Phase0: Establishing/Verifying Structure]")
                    
                    // 
                    // delete all autogenerated stuff (would be more efficient to only delete whats needed, but much harder to do provably-correctly)
                    // 
                    debuggingLevel > 1 && console.log(`    purging all autogenerated files for purity`)
                    const autogeneratedPattern = "**/*.autogenerated.deno.js"
                    virkshop._internal.deadlines.beforeSetup.push(
                        glob(autogeneratedPattern, {startPath: virkshop.pathTo.events, }).then(FileSystem.remove)
                    )
                    
                    // warnings (intentionally not awaited)
                    FileSystem.listFilePathsIn(virkshop.pathTo.plugins).then(paths=>{
                        const fileExtensionsToIgnore = (virkshop.options.fileExtensionsToIgnore||[])
                        for (const path of paths) {
                            // skip plugins
                            if (path.endsWith(".deno.js")) {
                                continue
                            }
                            // skip intentionally ignored extensions
                            if (fileExtensionsToIgnore.some(extension=>path.endsWith(extension))) {
                                continue
                            }
                            // make warning for unknown files in the plugin section
                            const relativePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.virkshop, to: path })
                            console.warn(`        [warning] if this was supposed to be a plugin, make sure it ends with .deno.js`)
                            console.warn(`                  ${JSON.stringify(relativePath)}`)
                            console.warn(`                  if you want to get rid of this warning, add another file extension to`)
                            console.warn(`                  virkshop/settings.yaml under the "fileExtensionsToIgnore" list`)
                        }
                    })
                    
                    // TODO: purge broken system links more
                    
                    await Promise.all([
                        // load all plugins
                        ...(await glob("**/*.deno.js", {startPath: virkshop.pathTo.plugins, })).map(
                            eachPath=>virkshop._internal.setupPlugin(eachPath, virkshop)
                        ),

                        // link virkshop folders up-and-out into the project folder
                        ...Object.entries(virkshop.options.projectLinks||[]).map(async ([whereInProject, whereInVirkshop])=>{
                            // TODO: make $VIRKSHOP_FOLDER and $PROJECT_FOLDER required at the front
                            whereInProject = whereInProject.replace(/^\$PROJECT_FOLDER\//, "./")
                            whereInVirkshop = whereInVirkshop.replace(/^\$VIRKSHOP_FOLDER\//, "./")
                            const sourcePath = `${virkshop.pathTo.virkshop}/${whereInVirkshop}`
                            const target = await FileSystem.info(`${virkshop.pathTo.project}/${whereInProject}`)
                            if (target.isBrokenLink) {
                                await FileSystem.remove(target.path)
                            }
                            // create it, but dont destroy an existing folder (unless its a broken link)
                            if (target.isBrokenLink || !target.exists)  {
                                await FileSystem.relativeLink({
                                    existingItem: sourcePath,
                                    newItem: target.path,
                                    overwrite: true,
                                })
                            }
                        }),
                    ])
                },
                // 
                // 
                // phase 1: runs setup_without_system_tools and setup_with_system_tools
                // 
                // 
                async phase1() {
                    debuggingLevel && console.log("[Phase1: Starting before-system-tools work]")

                    // 
                    // make all the numbers correct
                    // 
                    await virkshop._internal.fixupEventPathNumbers() // need to fixup before reading events
                    
                    // 
                    // run setup_without_system_tools
                    // 
                    const eventName = "@setup_without_system_tools"
                    const alreadExecuted = new Set()
                    const parentFolderString = `${virkshop.pathTo.events}/${eventName}`
                    const selfSetupPromise = FileSystem.recursivelyListItemsIn(parentFolderString).then(
                        async (phase1Items)=>{
                            virkshop._internal.sortPrioitiesByPath(phase1Items, (each)=>each.path.slice(parentFolderString.length))
                            const startTime = (new Date()).getTime()
                            for (const eachItem of phase1Items) {
                                // if its not a folder
                                if (!eachItem.isFolder && eachItem.exists) {
                                    await FileSystem.addPermissions({path: eachItem.path, permissions: { owner: {canExecute: true} }})
                                    try {
                                        // if importable, then import it
                                        if (eachItem.path.endsWith(".deno.js")) {
                                            const uniquePath = await FileSystem.finalTargetOf(eachItem.path)
                                            if (!alreadExecuted.has(uniquePath)) {
                                                alreadExecuted.add(uniquePath)
                                                // puts things inside of virkshop._internal.deadlines
                                                await virkshop.importDeadlinesFrom({
                                                    path: eachItem.path,
                                                    source: eachItem.path.slice(parentFolderString.length),
                                                    eventName,
                                                })
                                            }
                                        // otherwise execute it
                                        } else {
                                            (debuggingLevel >= 2) && console.log(`    [Running ${eachItem.path}]`)
                                            await FileSystem.addPermissions({ path: eachItem.path, permissions: { owner: {canExecute: true} }})
                                            await $$`${eachItem.path}`
                                        }
                                    } catch (error) {
                                        console.warn(`\n\nWARNING: error while executing ${eachItem.path}, ${error.stack}`,)
                                    }
                                }
                            }
                            const duration = (new Date()).getTime() - startTime
                            debuggingLevel && console.log(`    [${duration}ms: ${eventName}]`)
                        }
                    )
                    virkshop._internal.deadlines.beforeSetup.push(selfSetupPromise)

                    // 
                    // kick-off work for steps below so that it runs ASAP
                    // 
                    virkshop._internal.deadlines.beforeShellScripts.push(selfSetupPromise.then(async ()=>{
                        // read the the before_login files as soon as possible
                        const eventName = `@setup_with_system_tools`
                        const parentFolderString = `${virkshop.pathTo.events}/${eventName}`
                        const files = await FileSystem.listFilePathsIn(parentFolderString)
                        await Promise.all(files.map(async eachPath=>{
                            if (eachPath.match(/\.deno\.js$/)) {
                                virkshop._internal.shellSetupPriorities.push(
                                    [
                                        eachPath.slice(parentFolderString.length),
                                        `deno run ${denoFlags} ${shellApi.escapeShellArgument(eachPath)}`,
                                    ]
                                )
                            } else if (eachPath.match(/\.zsh$/)) {
                                virkshop._internal.shellSetupPriorities.push(
                                    [
                                        eachPath.slice(parentFolderString.length),
                                        await FileSystem.read(eachPath),
                                    ]
                                )
                            } else {
                                console.warn(`\n\nThis file: ${eachPath}\nwas inside a ${eventName}/\nBut it didn't have a .zsh or .deno.js file extension\n(so it will be ignored besides generating this warning)`)
                            }
                        }))
                    }))

                    // 
                    // finish the beforeSetup
                    // 
                    await Promise.all(virkshop._internal.deadlines.beforeSetup)

                    // 
                    // the two operations below can be done in any order, which is why they're in this Promise.all
                    // 
                    var startTime = (new Date()).getTime()
                    var defaultWarehouse
                    await Promise.all([
                        // 
                        // parse the systemTools string
                        // 
                        ((async ()=>{
                            // make sure the systemTools file is stable
                            await Promise.all(virkshop._internal.deadlines.beforeReadingSystemTools)
                            
                            // string may have been modified by plugins
                            debuggingLevel > 1 && console.log(`    reading ${virkshop.pathTo.systemTools} (only time this file is read)`)
                            const yamlString = await FileSystem.read(virkshop.pathTo.systemTools)
                            // intentionally dont await
                            FileSystem.write({
                                data: yamlString,
                                path: virkshop.pathTo.systemTools,
                            })
                            // TODO: get a hash of this and see if nix-shell should even be regenerated or not (as an optimization)
                            const result = await systemToolsToNix({
                                string: yamlString,
                                path: virkshop.pathTo.systemTools,
                                coreWarehouse,
                                modifyEnvVar: shellApi.modifyEnvVar,
                                escapeShellArgument: shellApi.escapeShellArgument
                            })
                            virkshop._internal.finalShellCode += result.finalShellCode
                            defaultWarehouse = result.defaultWarehouse
                            // this ensure shouldn't be needed but its a sanity thing, test removal later with a fresh setup
                            await FileSystem.ensureIsFolder(FileSystem.parentPath(virkshop.pathTo._tempNixShellFile))
                            // TODO: add error for no default warehouse
                            await FileSystem.write({
                                data: result.string,
                                path: virkshop.pathTo._tempNixShellFile,
                                overwrite: true,
                            })
                        })()),
                        
                        // 
                        // create the new home folder
                        // 
                        ((async ()=>{
                            
                            const fileConnectionOperations = {
                                ignore: async ({homePathTarget, item})=>{},
                                append: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        console.warn(`    [warning]: ${item} is a folder (cannot @append it)`)
                                    } else {
                                        // Should use a proper locking append operation, but currently (Jan 2023) FileSystem.append is not actually appending
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: `${await FileSystem.read(homePathTarget) || ""}\n${await FileSystem.read(item.path)}`,
                                        })
                                    }
                                },
                                prepend: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        console.warn(`    [warning]: ${item} is a folder (cannot @append it)`)
                                    } else {
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: `${await FileSystem.read(item.path)}\n${(await FileSystem.read(homePathTarget)||"")}`,
                                        })
                                    }
                                },
                                overwrite: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        await FileSystem.relativeLink({
                                            existingItem: item,
                                            newItem: homePathTarget,
                                            force: true,
                                            overwrite:true
                                        })
                                    } else {
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: await FileSystem.read(item.path),
                                        })
                                    }
                                },
                                make: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        await FileSystem.ensureIsFolder(homePathTarget)
                                    } else {
                                        // make executable
                                        await FileSystem.addPermissions({ path: item.path, permissions: { owner: {canExecute: true} }})
                                        // run the executable, and use the output as a file
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: await $$`${item.path}`.text("stdout"),
                                        })
                                    }
                                },
                                copy_real: async ({homePathTarget, item})=>{
                                    const targetItem = await FileSystem.info(homePathTarget)
                                    // only copy once
                                    if (!targetItem.exists) {
                                        const relativeHomePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.fakeHome, to: homePathTarget })
                                        const realHomePath = `${virkshop.pathTo.realHome}/${relativeHomePath}`
                                        const realHomeItem = await FileSystem.info(realHomePath)
                                        if (!realHomeItem.exists) {
                                            if (item.isFolder) {
                                                await FileSystem.ensureIsFolder(realHomeItem.path)
                                            } else {
                                                await FileSystem.ensureIsFile(realHomeItem.path)
                                            }
                                        }
                                        
                                        await FileSystem.copy({
                                            from: realHomePath,
                                            to: homePathTarget,
                                        })
                                    }
                                },
                                link_real: async ({homePathTarget, item})=>{
                                    const targetItem = await FileSystem.info(homePathTarget)
                                    // only link once
                                    if (!targetItem.isSymlink) {
                                        const relativeHomePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.fakeHome, to: homePathTarget })
                                        const realHomePath = `${virkshop.pathTo.realHome}/${relativeHomePath}`
                                        const realHomeItem = await FileSystem.info(realHomePath)
                                        if (!realHomeItem.exists) {
                                            if (item.isFolder) {
                                                await FileSystem.ensureIsFolder(realHomeItem.path)
                                            } else {
                                                await FileSystem.ensureIsFile(realHomeItem.path)
                                            }
                                        }
                                        
                                        await FileSystem.absoluteLink({
                                            existingItem: realHomePath,
                                            newItem: homePathTarget,
                                        })
                                    }
                                },
                            }
                            const operationSchedule = Object.fromEntries(Object.keys(fileConnectionOperations).map(each=>[each, []]))
                            const possibleNames = Object.keys(fileConnectionOperations).map(each=>`@${each}`)
                            await Promise.all(
                                (await FileSystem.listItemsIn(virkshop.pathTo.homeMixin, { recursively: true})).map(async (eachItem)=>{
                                    const theBasename = FileSystem.basename(eachItem.path)
                                    const relativePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.homeMixin, to: eachItem.path, })
                                    const homePathTarget = `${virkshop.pathTo.fakeHome}/${FileSystem.parentPath(relativePath)}/${theBasename.replace(/^@[^ ]+ /, "")}`
                                    
                                    // if it doesnt start with a command, then we have a problem
                                    if (!possibleNames.some(each=>theBasename.startsWith(`${each} `))) {
                                        if (!eachItem.isFolder) {
                                            console.warn(`    [warning]: ${eachItem.path} should start with one of: ${possibleNames.join(",")} followed by a space`)
                                        } else {
                                            let isEmpty = true
                                            for await (const each of FileSystem.iteratePathsIn(eachItem)) {
                                                isEmpty = false
                                                break
                                            }
                                            if (isEmpty) {
                                                console.warn(`    [warning]: ${eachItem.path} should either contain something that starts with one of:`)
                                                console.warn(`               ${possibleNames.join(",")}`)
                                                console.warn(`               or the item itself should start with one of those`)
                                                console.warn(`    [continuing despite warning]`)
                                            }
                                            // if not empty, then do nothing because we will end up checking the children on another iteration
                                        }
                                    } else {
                                        const operation = theBasename.match(/^@([^ ]+) /)[1]
                                        operationSchedule[operation].push({
                                            operation,
                                            homePathTarget,
                                            item: eachItem,
                                        })
                                    }
                                })
                            )
                            
                            // clear out the things that must be recreated
                            await Promise.all([
                                ...operationSchedule.append.map(({ homePathTarget })=>FileSystem.remove(homePathTarget)),
                                ...operationSchedule.prepend.map(({ homePathTarget })=>FileSystem.remove(homePathTarget)),
                            ])
                            
                            // 
                            //  create the shell file
                            // 
                                let shellProfileString = shellApi.shellProfileString
                                
                                // 
                                // add @setup_with_system_tools scripts
                                // 
                                await Promise.all(virkshop._internal.deadlines.beforeShellScripts)
                                // fixup path numbers one more time (now that plugins have created more events)
                                await virkshop._internal.fixupEventPathNumbers()
                                virkshop._internal.sortPrioitiesByPath(virkshop._internal.shellSetupPriorities , ([eachSource, ...otherData])=>eachSource)
                                for (const [eachSource, eachContent] of virkshop._internal.shellSetupPriorities) {
                                    if (debuggingLevel) {
                                        shellProfileString += `\necho ${shellApi.escapeShellArgument(`    [loading: ${FileSystem.basename(eachSource)}]`)}`
                                    }
                                    shellProfileString += `\n#\n# ${eachSource}\n#\n${eachContent}\n`
                                }
                                
                                // 
                                // add project commands
                                // 
                                shellProfileString += `
                                    #
                                    # inject project's virkshop commands
                                    #
                                    ${shellApi.generatePrependToPathString(virkshop.pathTo.commands)}
                                `.replace(/\n */g,"\n")
                                
                                // 
                                // make folders work as recursive commands
                                // 
                                for (const eachFolderPath of await FileSystem.listFolderPathsIn(virkshop.pathTo.commands)) {
                                    shellProfileString += shellApi.createHierarchicalCommandFor(eachFolderPath)
                                }
                                
                                const autogeneratedPath = `${virkshop.pathTo.fakeHome}/${shellApi.autogeneratedProfile}`
                                await FileSystem.info(shellApi.profilePath).then(async (itemInfo)=>{
                                    await FileSystem.write({
                                        path: shellApi.profilePath,
                                        data: `
                                            . ./${shellApi.escapeShellArgument(shellApi.autogeneratedProfile)}
                                        `.replace(/\n                                            /g, "\n"),
                                    })
                                })

                                shellProfileString += virkshop._internal.finalShellCode
                                
                                // write the new shell profile
                                await FileSystem.write({
                                    path: autogeneratedPath,
                                    data: shellProfileString,
                                    force: true,
                                    overwrite: true,
                                })
                            
                            // 
                            // finally run/check every operation, by operation group
                            // 
                            for (const [operation, scheduledCalls] of Object.entries(operationSchedule)) {
                                await Promise.all(scheduledCalls.map(
                                    argument=>fileConnectionOperations[operation](argument)
                                ))
                            }

                        })()),
                    ])
                    var duration = (new Date()).getTime() - startTime; var startTime = (new Date()).getTime()
                    debuggingLevel && console.log(`    [${duration}ms creating shell profile and shell.nix from system_tools.yaml]`)
                    
                    // 
                    // finish dynamic setup
                    // 
                    await Promise.all(virkshop._internal.deadlines.beforeEnteringVirkshop)
                    
                    // make all commands executable
                    const permissionPromises = []
                    for await (const eachCommand of FileSystem.recursivelyIterateItemsIn(virkshop.pathTo.commands)) {
                        if (eachCommand.isFile) {
                            permissionPromises.push(
                                FileSystem.addPermissions({path: eachCommand.path, permissions: { owner: {canExecute: true} }}).catch()
                            )
                        }
                    }
                    await Promise.all(permissionPromises)
                    
                    var duration = (new Date()).getTime() - startTime; var startTime = (new Date()).getTime()
                    debuggingLevel && console.log(`    [${duration}ms waiting on beforeEnteringVirkshop]`)
                    debuggingLevel && console.log(`[Phase2: Starting the with-system-tools work] note: this step can take a while`)
                    
                    // 
                    // run nix-shell
                    // 
                    const newPwd = FileSystem.parentPath(virkshop.pathTo._tempNixShellFile)
                    const envVars = {
                        _shell_start_time: `${startTime}`,
                        VIRKSHOP_FOLDER: virkshop.pathTo.virkshop,
                        PROJECT_FOLDER: virkshop.pathTo.project,
                        VIRKSHOP_HOME: virkshop.pathTo.fakeHome,
                        VIRKSHOP_USERS_HOME: virkshop.pathTo.realHome,
                        VIRKSHOP_DEBUG: `${debuggingLevel}`,
                        NIX_SSL_CERT_FILE: Console.env.NIX_SSL_CERT_FILE,
                        NIXPKGS_ALLOW_UNFREE: "1",
                        NIX_PROFILES: Console.env.NIX_PROFILES,
                        HOME: virkshop.pathTo.fakeHome,
                        PATH: Console.env.PATH,
                        PWD: newPwd,
                        _PWD: Console.env.PWD,
                        TMPDIR: "/tmp", // fixes some build problems (workaround for a bug in Nix)
                        SHELL: Console.env.SHELL,
                        USER: Console.env.USER,
                        SSH_AUTH_SOCK: Console.env.SSH_AUTH_SOCK || '',
                        SHLVL: Console.env.SHLVL || '',
                        OLDPWD: Console.env.OLDPWD || '',
                        COLORTERM: Console.env.COLORTERM || '',
                        TERM: Console.env.TERM || '',
                        COMMAND_MODE: "unix2003",
                        LANG: "en_US.UTF-8", // TODO: put this in settings
                    }
                    const args = [
                        "nix-shell",
                        ...(debuggingLevel > 0 ? [ `-${"v".repeat(Math.min(debuggingLevel,5))}` ] : []),
                        "--pure",
                        "--command", shellApi.startCommand,
                        ...Object.keys(envVars).map(
                            name=>["--keep", name]
                        ).flat(),
                        `${virkshop.pathTo._tempNixShellFile}`,
                        "-I", `nixpkgs=${defaultWarehouse.tarFileUrl}`,
                    ]
                    if (debuggingLevel > 3) {
                        console.debug(`calling nix-shell with args:`,args)
                    }
                    await $$`${args}`.env(envVars).cwd(newPwd)
                    // TODO: call all the on_quit scripts
                },
            },
            async enter() {
                await virkshop._stages.phase0() // phase 0: creates/discovers basic virkshop structure (establish linked files/folders, clean broken links)
                await virkshop._stages.phase1() // phase 1: runs setup_without_system_tools
            },
            async trigger(eventPath) {
                const alreadExecuted = new Set()
                const fullPathToEvent = `${virkshop.pathTo.events}/${eventPath}`
                for await (const eachPath of FileSystem.recursivelyIteratePathsIn(fullPathToEvent, { searchOrder: 'depthFirstSearch', })) {
                    const uniquePath = await FileSystem.finalTargetOf(eachPath)
                    if (!alreadExecuted.has(uniquePath)) {
                        var failed = false
                        try {
                            // if deno, then import it (much faster than executing it)
                            if (eachPath.endsWith(".deno.js")) {
                                const escapedPath = `${encodeURIComponent(eachPath).replace(/%2F/g,'/')}`
                                await import(escapedPath)
                            // otherwise execute it using the hashbang
                            } else {
                                await FileSystem.addPermissions({
                                     path: eachPath, 
                                     permissions: { owner: { canExecute: true} },
                                })
                                var { code: failed } = await $$`${eachPath}`
                            }
                            alreadExecuted.add(eachPath)
                        } catch (error) {
                            console.warn(`    Tried to trigger ${eachPath}, but there was an error:\n`, error)
                        }
                        if (failed) {
                            console.warn(`    Tried to trigger ${eachPath}, but there was an error (info above)`)
                        }
                    }
                }
            },
            async importDeadlinesFrom({path, eventName, source }) {
                const escapedPath = `${encodeURIComponent(path).replace(/%2F/g,'/')}`
                const {deadlines} = await import(escapedPath) || {}
                for (const eachDeadlineName of Object.keys(virkshop._internal.deadlines)) {
                    if (deadlines[eachDeadlineName] instanceof Function) {
                        virkshop._internal.deadlines[eachDeadlineName].push(
                            // start the function, and we'll await it at the respective deadline
                            deadlines[eachDeadlineName](
                                virkshop._internal.createApi({
                                    source,
                                    eventName,
                                    deadlineName: eachDeadlineName,
                                })
                            )
                        )
                    }
                }
            },
        },
        {
            folder:      { get() { return virkshop.pathTo.virkshop } }, // alias
            projectName: { get() { return FileSystem.basename(virkshop.pathTo.project)   } },
            options: { 
                get() {
                    if (virkshopCache.options) {
                        return virkshopCache.options
                    }

                    let yamlString
                    try {
                        yamlString = Deno.readTextFileSync(virkshop.pathTo.virkshopOptions)
                    } catch (error) {
                        debuggingLevel && console.log(`Couldn't find the ${FileSystem.basename(virkshop.pathTo.virkshopOptions)} file, so one will be created`)
                        // TODO: update this string before final release
                        yamlString = `
                            virkshop:
                                projectLinks:
                                    "$PROJECT_FOLDER/system_tools.yaml": "$VIRKSHOP_FOLDER/system_tools.yaml"
                                    "$PROJECT_FOLDER/commands":          "$VIRKSHOP_FOLDER/commands"
                                    "$PROJECT_FOLDER/events":            "$VIRKSHOP_FOLDER/events"
                                
                                debuggingLevel: 1
                        `.replace(/\n                            /g,"\n")
                        // async write is not awaited because this is inside a getter
                        FileSystem.write({
                            data: yamlString,
                            path: virkshop.pathTo.virkshopOptions,
                        })
                    }
                    virkshopCache.options = yaml.parse(yamlString).virkshop
                    return virkshopCache.options
                },
            },
        },
    )
    
    // ensure these are set for any @setup_without_system_tools imports
    Console.env.VIRKSHOP_FOLDER = virkshop.pathTo.virkshop
    Console.env.PROJECT_FOLDER  = virkshop.pathTo.project
    
    debuggingLevel = virkshop.options.debuggingLevel
    return virkshop
}
export const virkshop = await createVirkshop()

// 
// shellApi
// 
export const shellApi = Object.defineProperties(
    {
        autogeneratedProfile: `.zshrc.autogenerated.ignore`,
        startCommand: "zsh --no-globalrcs",
        protectedPaths: [ ".zshrc", ".zshenv", ".zlogin", ".zlogout", ".zprofile" ], // TODO: check that zlogout zprofile are correct
        fileExtensions: [ `.zsh` ],
        shellProfileString: `
            cd "$_PWD" # go back to real location
            unset _PWD

            # don't let zsh update itself without telling all the other packages 
            # instead use nix to update zsh
            DISABLE_AUTO_UPDATE="true"
            DISABLE_UPDATE_PROMPT="true"
            
            if ! [ "$VIRKSHOP_DEBUG" = "0" ]; then
                deno eval --no-lock --quiet 'console.log(\`    [\${(new Date()).getTime()-Deno.env.get("_shell_start_time")}ms nix-shell]\`)'
            fi
            unset _shell_start_time

            # this wrapper is done so that,if the virkshop command ever needs to perform shell operations (e.g. cd or ENV manipulation) it can
            @virkshop () {
                ${posixShellEscape(virkshop.pathTo.virkshopCommand)} "$@"
            }
        `,
        lineComment(string) {
            return `# ${string}`
        },
        escapeShellArgument(string) {
            return posixShellEscape(string)
        },
        generatePrependToPathString(newPath) {
            return `export PATH=${this.escapeShellArgument(newPath)}":$PATH"`
        },
        generateAppendToPathString(newPath) {
            return `export PATH="$PATH:"${this.escapeShellArgument(newPath)}`
        },
        createHierarchicalCommandFor(folderPath) {
            const name = this.escapeShellArgument(FileSystem.basename(folderPath))
            folderPath = FileSystem.makeAbsolutePath(folderPath)
            return `
                # 
                # command for ${name} folder
                # 
                    ${name} () {
                        # enable globbing
                        setopt extended_glob &>/dev/null
                        shopt -s globstar &>/dev/null
                        shopt -s dotglob &>/dev/null
                        local search_path=${this.escapeShellArgument(folderPath)}
                        local argument_combination="$search_path/$1"
                        while [[ -n "$@" ]]
                        do
                            shift 1
                            for each in "$search_path/"**/*
                            do
                                if [[ "$argument_combination" = "$each" ]]
                                then
                                    # if its a folder, then we need to go deeper
                                    if [[ -d "$each" ]]
                                    then
                                        search_path="$each"
                                        argument_combination="$argument_combination/$1"
                                        
                                        # if there is no next argument
                                        if [[ -z "$1" ]]
                                        then
                                            printf "\\nThat is a sub folder, not a command\\nValid sub-commands are\\n" 1>&2
                                            ls -1FL --group-directories-first --color "$each" | sed 's/^/    /' | sed -E 's/(\\*|@)$/ /' 1>&2
                                            return 1 # error, no command
                                        fi
                                        
                                        break
                                    # if its a file, run it with the remaining arguments
                                    elif [[ -f "$each" ]]
                                    then
                                        "$each" "$@"
                                        # make exit status identical to executed program
                                        return $?
                                    fi
                                fi
                            done
                        done
                        # if an option was given
                        if ! [ -z "$each" ]
                        then
                            echo "$each"
                            printf "\\nI could not find that sub-command\\n" 1>&2
                        fi
                        printf "Valid next-arguments would be:\\n" 1>&2
                        ls -1FL --group-directories-first --color "$search_path" | sed 's/^/    /' | sed -E 's/(\\*|@)$/ /' 1>&2
                        return 1 # error, no command
                    }
                    '__autocomplete_for__'${name} () {
                        local commands_path=${this.escapeShellArgument(FileSystem.parentPath(folderPath))}
                        # TODO: make this space friendly
                        # TODO: make this do partial-word complete 
                        function join_by { local d=\${1-} f=\${2-}; if shift 2; then printf %s "$f" "\${@/#/$d}"; fi; }
                        local item_path="$(join_by "/" $words)"
                        if [ -d "$commands_path/$item_path" ]
                        then
                            compadd $(ls "$commands_path/$item_path")
                        elif [ -d "$(dirname "$commands_path/$item_path")" ]
                        then
                            # check if file exists (finished completion)
                            if ! [ -f "$commands_path/$item_path" ]
                            then
                                # TODO: add a better check for sub-matches "java" [tab] when "java" and "javascript" exist
                                compadd $(ls "$(dirname "$commands_path/$item_path")")
                            fi
                        fi
                        # echo "$(dirname "$commands_path/$item_path")"
                    }
                    compdef '__autocomplete_for__'${name} ${name}
            `.replace(/\n                /g, "\n")
        },
        modifyEnvVar({ name, overwriteAs, prepend, append, joinUsing="", }) {
            name = name.trim()
            if (overwriteAs) {
                return `\nexport ${name}=${this.escapeShellArgument(overwriteAs)}\n`
            }
            
            let output = ""
            if (prepend) {
                output += `
                    if [ -z "$${name}" ]; then
                        export ${name}=${this.escapeShellArgument(prepend)}
                    else
                        export ${name}=${this.escapeShellArgument(prepend)}${this.escapeShellArgument(joinUsing)}"$${name}"
                    fi
                `.replace(/\n                    /,"\n")
            }

            if (append) {
                output += `
                    if [ -z "$${name}" ]; then
                        export ${name}=${this.escapeShellArgument(append)}
                    else
                        export ${name}="$${name}"${this.escapeShellArgument(joinUsing)}${this.escapeShellArgument(append)}
                    fi
                `.replace(/\n                    /,"\n")
            }

            return output
        },
        callCommand(commandName, ...args) {
            return [commandName, ...args].map(each=>shellApi.escapeShellArgument(each)).join(" ")
        },
        tempVar({name, value}) {
            if (!name.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
                throw Error(`tried to call shellApi.tempVar({ name: ${JSON.stringify(name)}, }) but that name is too exotic. Please use a typical variable name`)
            }
            return `${name}=${shellApi.escapeShellArgument(value)}`
        },
        joinStatements(commands) {
            return commands.flat(Infinity).join("\n;\n")
        },
    },
    {
        profilePath:         { get() { return `${virkshop.pathTo.fakeHome}/.zshrc` } },
    },
)

// export async function nixHashFor(tarFileUrl) {
//     const pathInfo = await FileSystem.info(tarFileUrl)
//     const tempPath = `${virkshop.pathTo.temporary}/long_term/${tarFileUrl}`
//     if (!pathInfo.isFile) {
//         await FileSystem.write({
//             data: await fetch(tarFileUrl).then(value=>value.arrayBuffer()),
//             path: tempPath,
//         })
//     }
//     return await $$`nix-hash --flat --base32 --type sha256 ${tempPath}`.text("stdout")
// }