import { Type } from "https://deno.land/std@0.82.0/encoding/_yaml/type.ts"
import * as yaml from "https://deno.land/std@0.82.0/encoding/yaml.ts"
import { FileSystem, glob } from "https://deno.land/x/quickr@0.6.66/main/file_system.js"
import { recursivePromiseAll } from "../generic_tools/recursive_promise_all.js"
import { toNixValue } from "./nix_tools.js"

// 
// 
// Yaml support
// 
// 
class CustomYamlType {
    asString = null
    [toNixValue]() {
        return this.asString
    }
}

const SchemaClass = Object.getPrototypeOf(yaml.DEFAULT_SCHEMA).constructor
const duplicateSchema = (schema)=>new SchemaClass({
    explicit: [...schema.explicit],
    implicit: [...schema.implicit],
    include: [...schema.include],
})
const extendedSchema = duplicateSchema(yaml.DEFAULT_SCHEMA)
function createCustomTag({tagName, javascriptValueisACustomType, yamlNodeIsValidACustomType, createJavasriptValueFromYamlString, customValueToYamlString, kind="scalar", schema=extendedSchema}) {
    if (kind != "scalar") {
        throw Error(`Sorry in createCustomTag({ kind: '${kind}' }), the only valid kind (currently) is scalar`)
    }
    const universalTag = `tag:yaml.org,2002:${tagName}`
    class ACustomType extends CustomYamlType {}

    const customValueSupport = new Type(universalTag, {
        kind: "scalar",
        predicate: javascriptValueisACustomType || function(object) {
            return object instanceof ACustomType
        },
        resolve: yamlNodeIsValidACustomType || function(data) {
            return true
        },
        construct: createJavasriptValueFromYamlString || function(data) {
            const customValue = new ACustomType()
            customValue.asString = data
            return customValue
        },
        represent: customValueToYamlString || function(object /*, style*/) {
            return customValue.asString
        },
    })

    // hack it into the default schema (cause .extend() isnt available)
    schema.explicit.push(customValueSupport)
    schema.compiledTypeMap.fallback[universalTag] = customValueSupport
    schema.compiledTypeMap.scalar[universalTag] = customValueSupport

    return ACustomType
}

// 
// !!nix support
// 
    const validVariableNameRegex = /^ *\b[a-zA-Z_][a-zA-Z_0-9]*\b *$/
    const NixValue = createCustomTag({
        tagName: "nix",
    })
// 
// !!var support
// 
    const SystemToolVar = createCustomTag({
        tagName: "var",
        yamlNodeIsValidACustomType(data) {
            if (typeof data !== 'string') return false
            if (data.length === 0) return false
            
            data = data.trim()
            // if its a variable name
            return !!data.match(validVariableNameRegex)
        },
        createJavasriptValueFromYamlString(data) {
            const nixVar = new SystemToolVar()
            nixVar.asString = data
            nixVar.name = data.trim()
            return nixVar
        }
    })
    Object.getPrototypeOf(SystemToolVar)[toNixValue] = function() {
        return this.name
    }
    
// 
// !!deno support
// 
    const DenoExecutePromise = createCustomTag({
        tagName: "deno",
        createJavasriptValueFromYamlString(data) {
            // if there is a default export somewhere, its very likely not in a string (so try NOT prepending default export)
            if (data.match(/export default/)) {
                return import(`data:text/javascript;base64, ${btoa(data)}`).catch(()=>import(`data:text/javascript;base64, ${btoa(`export default ${data}`)}`)).then((value)=>value.default)
            // otherwise we can be sure a default export is needed
            } else {
                return import(`data:text/javascript;base64, ${btoa(`export default ${data}`)}`).then((value)=>value.default)
            }
        }
    })

export const readExtendedYaml = async ({path, string})=>{
    const locallyHandledSchema = duplicateSchema(extendedSchema)
    const folderOfYamlFile = path && FileSystem.parentPath(path)
    // 
    // !!as_absolute_path support
    // 
    const AbsolutePathTag = createCustomTag({
        tagName: "as_absolute_path",
        schema: locallyHandledSchema,
        createJavasriptValueFromYamlString(data) {
            const relativePathString = data
            if (!folderOfYamlFile) {
                // relative to CWD if there was no file
                return FileSystem.makeAbsolutePath(relativePathString)
            } else {
                return FileSystem.normalize(
                    FileSystem.makeAbsolutePath(
                        `${folderOfYamlFile}/${relativePathString}`
                    )
                )
            }
        }
    })
    string = string || await FileSystem.read(path)
    const dataStructure = await recursivePromiseAll(yaml.parse(string, {schema: locallyHandledSchema,}))
    return dataStructure
}

export const parsePackageTools = async (pathToPackageTools)=>{
    // in the future their may be some extra logic here
    const asString = await FileSystem.read(pathToPackageTools)
    const dataStructure = await readExtendedYaml({path: pathToPackageTools, string: asString})
    const allSaveAsValues = dataStructure.map(each=>each[Object.keys(each)[0]].saveVariableAs)
    const illegalNames = allSaveAsValues.filter(each=>`${each}`.startsWith("_-"))
    if (illegalNames.length > 0) {
        throw Error(`Inside ${pathToPackageTools}, there are some illegal saveVariableAs names (names that start with "_-")\nPlease rename these values:${illegalNames.map(each=>`\n    saveVariableAs: ${each}`).join("")}`)
    }
    dataStructure.asString = asString
    dataStructure.packages = dataStructure.map(each=>each["(integrate)"]).filter(each=>each instanceof Object)
    dataStructure.warehouses = dataStructure.map(each=>each["(warehouse)"] || each["(defaultWarehouse)"]).filter(each=>each instanceof Object)
    dataStructure.defaultWarehouse = dataStructure.map(each=>each["(defaultWarehouse)"]).filter(each=>each instanceof Object).slice(-1)[0]
    dataStructure.directPackages = dataStructure.packages.filter(each=>each.asBuildInput&&(each.load instanceof Array))
    
    // TODO: add validation (better error messages) for missing warehouse attributes
    for (const each of dataStructure.warehouses) {
        const nixCommitHash = each.createWarehouseFrom.nixCommitHash
        const tarFileUrl = each.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
        // ensure each has a tarFileUrl
        each.createWarehouseFrom.tarFileUrl = tarFileUrl
    }

    return dataStructure
}

// 
// systemToolsToNix
// 
export const systemToolsToNix = async function({string, path}) {
    // TODO: add error for trying to assign to a keyword (like "builtins", "rec", "let", etc)
    const start = (new Date()).getTime()
    const dataStructure = await readExtendedYaml({path, string})
    const allSaveAsValues = dataStructure.map(each=>each[Object.keys(each)[0]].saveVariableAs)
    const frequencyCountOfVarNames = allSaveAsValues.filter(each=>each).reduce((frequency, item)=>(frequency[item]?frequency[item]++:frequency[item]=1, frequency), {})
    const varNames = []
    let defaultWarehouse = null
    let defaultWarehouseName = ""
    const buildInputStrings = []
    const nativeBuildInputStrings = []
    const computed = {}
    const nixValues = {}
    const warehouses = {}
    const packages = {}

    const uniqueVarValues = Object.fromEntries(Object.entries(frequencyCountOfVarNames).filter(([eachName, eachCount])=>eachCount==1))
    const nonUniqueVarNames = Object.entries(frequencyCountOfVarNames).filter(([eachName, eachCount])=>eachCount!=1).map((eachName, eachCount)=>eachName)
    const nonUniqueVarValuesSoFar = {}
    const nixVarsAtThisPoint = ()=>`\n${Object.entries(nonUniqueVarValuesSoFar).map(([eachVarName, eachNixString])=>`${eachVarName} = ${indent({ string: eachNixString, by: "    ", noLead: true })};`).join("\n")}`
    const saveNixVar = (varName, varNixValue)=>{
        varNames.push(varName)
        // if its going to end up unique, store it in the uniqueVarValues
        const storageLocation = uniqueVarValues[varName] ? uniqueVarValues : nonUniqueVarValuesSoFar
        const varsSoFar = nixVarsAtThisPoint().trim()
        if (varsSoFar.length == 0) {
            storageLocation[varName] = `${indent({ string: varNixValue, by: "    ", noLead: true })}`
        } else {
            storageLocation[varName] = `(
                let
                    ${indent({ string: nixVarsAtThisPoint(), by: "                    ", noLead: true })}
                in
                    ${indent({ string: varNixValue, by: "                    ", noLead: true })}
            )`.replace(/\n            /g,"\n")
        }
    }
    const warehouseAsNixValue = (values)=> {
        const nixCommitHash = values.createWarehouseFrom.nixCommitHash
        const tarFileUrl = values.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
        const tarFileHash = values.createWarehouseFrom.tarFileHash
        const warehouseArguments = values.arguments || {}
        if (!tarFileHash) {
            return `(_-_core.import
                (_-_core.fetchTarball
                    ({
                        url=${JSON.stringify(tarFileUrl)};
                    })
                )
                (${indent({ string: nix.escapeJsValue(warehouseArguments), by: "            ", noLead: true})})
            )`.replace(/\n            /g,"\n")
        } else {
            return `(_-_core.import
                (_-_core.fetchTarball
                    ({
                        url=${JSON.stringify(tarFileUrl)};
                        sha256=${JSON.stringify(tarFileHash)};
                    })
                )
                (${indent({ string: nix.escapeJsValue(warehouseArguments), by: "            ", noLead: true})})
            )`.replace(/\n            /g,"\n")
        }
    }

    for (const eachEntry of dataStructure) {
        const kind = Object.keys(eachEntry)[0]
        // 
        // (warehouse)
        // 
        if (kind == "(defaultWarehouse)" || kind == "(warehouse)") {
            // 
            // make sure defaultWarehouse is defined first, and that theres only one
            // 
            if (kind == "(defaultWarehouse)") {
                if (defaultWarehouse) {
                    throw Error(`Looks like (defaultWarehouse) is getting defined twice. Please check the yaml file to make sure theres only one (defaultWarehouse)`)
                }
            } else {
                if (!defaultWarehouseName) {
                    throw Error(`I see a warehouse being added, but the defaultWarehouse hasn't been defined yet. Please define one, its the same structure as a warehouse but with "(defaultWarehouse)" as the name`)
                }
            }
            const values = eachEntry[kind]
            // createWarehouseFrom:
            //     tarFileUrl: &defaultWarehouseAnchor "https://github.com/NixOS/nixpkgs/archive/c82b46413401efa740a0b994f52e9903a4f6dcd5.tar.gz"
            // arguments:
            //     config:
            //         allowUnfree: true
            //         cudaSupport: true
            //         permittedInsecurePackages: [ "openssl-1.0.2u" ]
            // saveVariableAs: "!!nix defaultWarehouse"

            const varName = values.saveVariableAs
            const nixCommitHash = values.createWarehouseFrom.nixCommitHash
            const tarFileUrl = values.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
            const warehouseArguments = values.arguments || {}
            warehouses[varName] = new SystemToolVar()
            warehouses[varName].name = varName
            warehouses[varName].tarFileUrl = tarFileUrl
            warehouses[varName].tarFileHash = values.createWarehouseFrom.sha256
            warehouses[varName].arguments = warehouseArguments
            // if is will end up being a unique name
            saveNixVar(varName, warehouseAsNixValue(values))
            // save defaultWarehouse name
            if (kind == "(defaultWarehouse)") {
                defaultWarehouseName = varName
                defaultWarehouse = warehouses[varName]
            }
        // 
        // (compute)
        // 
        } else if (kind == "(compute)") {
            // - (compute):
            //     runCommand: [ "nix-shell", "--pure", "--packages", "deno", "deno eval 'console.log(JSON.stringify(Deno.build.os==\'darwin\'))'", "-I", *defaultWarehouseAnchor ]
            //     saveVariableAs: isMac
            const values = eachEntry[kind]
            const varName = values.saveVariableAs
            let resultAsValue
            if (Object.keys(values).includes('value')) {
                // means it was a constant, or preprocessed via a !!deno tag
                resultAsValue = values.value
            } else {
                const withPackages = values.withPackages || []
                const whichWarehouse = values.fromWarehouse || defaultWarehouse
                const tarFileUrl = warehouses[whichWarehouse.name].tarFileUrl // TODO: there's a lot of things that could screw up here, add checks/warnings for them
                const escapedArguments = 'NO_COLOR=true '+values.runCommand.map(each=>`${shellApi.escapeShellArgument(each)}`).join(" ")
                const fullCommand = ["nix-shell", "--pure", "--packages", ...withPackages, "-I", "nixpkgs="+tarFileUrl, "--run",  escapedArguments,]
                
                const commandForDebugging = fullCommand.join(" ")
                if (! withPackages) {
                    throw Error(`For\n- (compute):\n    saveVariableAs: ${varName}\n    withPackages: []\nThe withPackages being empty is a problem. Try at least try: withPackages: ["bash"]`)
                }
                
                // TODO: make sure everything in the runCommand is a string
                let resultAsJson
                try {
                    resultAsJson = await run(...fullCommand, Stdout(returnAsString))
                    // TODO: grab STDOUT and STDERR for better error messages
                } catch (error) {
                    throw Error(`There was an error when trying to run this command:\n    ${commandForDebugging}`)
                }
                try {
                    resultAsValue = JSON.parse(resultAsJson)
                } catch (error) {
                    throw Error(`There was an error with the output of this command: ${commandForDebugging}\nThe output needs to be a valid JSON string, but there was an error while parsing the string: ${error}\n\nStandard output of the command was: ${JSON.stringify(resultAsJson)}`)
                }
            }
            computed[varName] = resultAsValue
            saveNixVar(varName, nix.escapeJsValue(resultAsValue))
        // 
        // (environmentVariable)
        // 
        } else if (kind == "(environmentVariable)") {
            const values = eachEntry[kind]
            if (values.onlyIf === false) {
                continue
            } else if (values.onlyIf instanceof SystemToolVar) {
                // skip if value is false
                if (!computed[values.onlyIf.name]) {
                    continue
                }
            } else {
                virkshop._internal.finalShellCode += shellApi.modifyEnvVar({ ...values, name: values.envVar })
            }
        // 
        // (integrate)
        // 
        } else if (kind == "(integrate)") {
            // from: !!warehouse pythonPackages
            // load: [ "pyopengl",]
            // onlyIf: !!computed isLinux
            // asBuildInput: true
            const values = eachEntry[kind]
            
            // 
            // handle onlyIf
            // 
            if (values.onlyIf === false) {
                continue
            } else if (values.onlyIf instanceof SystemToolVar) {
                // skip if value is false
                if (!computed[values.onlyIf.name]) {
                    continue
                }
            } else if (values.onlyIf instanceof NixValue) {
                // TODO values.onlyIf  !!nix
                throw Error(`
                    Sorry the !!nix part isn't supported yet in the beta
                    For this value:
                        - ${kind}:
                            onlyIf: !!nix ${values.onlyIf.asString}
                `)
            // string 
            } else if (values.onlyIf) {
                const onlyIfString = values.onlyIf.name || values.onlyIf
                throw Error(`
                    

                    Inside a system_tools.yaml file
                    For this value:
                        - ${kind}:
                            # [stuff]
                            onlyIf: ${onlyIfString}
                    
                    You might have been wanting this:
                        - ${kind}:
                            # [stuff]
                            onlyIf: !!computed ${onlyIfString}
                    
                    
                `.replace(/\n                    /g,"\n"))
            }

            
            // 
            // get nix-value
            // 
            const source = values.from || defaultWarehouse
            let nixValue
            if (values.load instanceof NixValue) {
                nixValue = `(${values.load.asString})`
            } else if (source instanceof SystemToolVar) {
                const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
                nixValue = `${source.name}.${loadAttribute}`
            // from a hash/url directly
            } else {
                const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
                if (source instanceof Object) {
                    nixValue = `${warehouseAsNixValue(source)}.${loadAttribute}`
                } else if (typeof source == "string") {
                    nixValue = `${warehouseAsNixValue({createWarehouseFrom:{ nixCommitHash:source }})}.${loadAttribute}`
                }
                // TODO: else error
            }
            
            // 
            // add to build inputs
            // 
            if (values.asBuildInput) {
                buildInputStrings.push(nixValue)
            }
            if (values.asNativeBuildInput) {
                nativeBuildInputStrings.push(nixValue)
            }
            
            // 
            // create name if needed
            // 
            if (values.saveVariableAs) {
                const varName = values.saveVariableAs
                packages[varName] = values
                saveNixVar(varName, nixValue)
            }
        // 
        // (nix)
        // 
        } else if (kind == "(nix)") {
            // from: !!warehouse pythonPackages
            // load: [ "pyopengl",]
            // saveVariableAs: varName
            const values = eachEntry[kind]
            
            // 
            // get nix-value
            // 
            const source = values.from || defaultWarehouse
            const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
            let nixValue
            if (source instanceof SystemToolVar) {
                nixValue = `${source.name}.${loadAttribute}`
            // from a hash/url directly
            } else {
                if (source instanceof Object) {
                    nixValue = `${warehouseAsNixValue(source)}.${loadAttribute}`
                } else if (typeof source == "string") {
                    nixValue = `${warehouseAsNixValue({createWarehouseFrom:{ nixCommitHash:source }})}.${loadAttribute}`
                }
                // TODO: else error
            }
            
            // 
            // create name if needed
            // 
            const varName = values.saveVariableAs
            nixValues[varName] = values
            saveNixVar(varName, nixValue)
        }
    }
    
    // TODO: validate that all varNames are actually valid variable names 

    // 
    // library paths for all packages
    // 
    let libraryPathsString = ""
    let packagePathStrings = ""
    for (const [varName, value] of Object.entries(packages)) {
        libraryPathsString += `"${varName}" = _-_core.lib.makeLibraryPath [ ${varName} ];\n`
        packagePathStrings += `"${varName}" = ${varName};\n`
    }
    
    return {
        defaultWarehouse,
        computed,
        nixValues,
        warehouses,
        packages,
        string: `
        let
            #
            # create a standard library for convienience 
            # 
            _-_core = (
                let
                    frozenStd = (builtins.import 
                        (builtins.fetchTarball
                            ({url=${nix.escapeJsValue(virkshop.coreWarehouse)};})
                        )
                        ({})
                    );
                in
                    (frozenStd.lib.mergeAttrs
                        (frozenStd.lib.mergeAttrs
                            (frozenStd.buildPackages) # <- for fetchFromGitHub, installShellFiles, getAttrFromPath, etc 
                            (frozenStd.lib.mergeAttrs
                                ({ stdenv = frozenStd.stdenv; })
                                (frozenStd.lib) # <- for mergeAttrs, optionals, getAttrFromPath, etc 
                            )
                        )
                        (builtins) # <- for import, fetchTarball, etc 
                    )
            );
            
            #
            # 
            # Packages, Vars, and Compute
            #
            #\n${Object.entries(uniqueVarValues).map(
                ([eachVarName, eachNixString])=>
                    `            ${eachVarName} = ${indent({ string: eachNixString, by: "            ", noLead: true })};`
            ).join("\n")}
            #
            # var names that were assigned more than once
            #${indent({ string: nixVarsAtThisPoint(), by: "            ", noLead: true })}
            #
            # nix shell data
            #
                _-_nixShellEscapedJsonData = (
                    let 
                        nixShellDataJson = (_-_core.toJSON {
                            libraryPaths = {\n${indent({string:libraryPathsString, by: "                                ",})}
                            };
                            packagePaths = {\n${indent({string:packagePathStrings, by: "                                ",})}
                            };
                        });
                        bashEscapedJson = (builtins.replaceStrings
                            [
                                "'"
                            ]
                            [
                                ${nix.escapeJsValue(`'"'"'`)}
                            ]
                            nixShellDataJson
                        );
                    in
                        bashEscapedJson
                );
        in
            _-_core.mkShell {
                # inside that shell, make sure to use these packages
                buildInputs =  [\n${indent({
                        string: [...new Set(buildInputStrings)].join("\n"),
                        by: "                    ",
                    })}
                ];
                
                nativeBuildInputs = [\n${indent({
                        string: [...new Set(nativeBuildInputStrings)].join("\n"),
                        by: "                    ",
                    })}
                ];
                
                # run some bash code before starting up the shell
                shellHook = "
                    export VIRKSHOP_NIX_SHELL_DATA='\${_-_nixShellEscapedJsonData}'
                ";
            }
        `.replace(/\n        /g,"\n"),
    }
}