"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("quickjs-emscripten");
const ts = __importStar(require("typescript"));
const sandbox_wrappers_1 = require("./sandbox-wrappers");
// Should we use "noEmitOnError": true ?
function tsCompile(source, options = null) {
    // Default options -- you could also perform a merge, or use the project tsconfig.json
    if (null === options) {
        options = {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.None,
            },
        };
    }
    return ts.transpileModule(source, options).outputText;
}
// function whitelist can be produced using something like:
// const assistantFunctions =  Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject))
//   .filter((f) => f !== "constructor" && !f.startsWith("_"));
// Is there some way we can treat the API and globals the same?
// We could just provide an object for all globals (including the API) and also have the whitelist as a parameter..
async function createSandbox(QuickJS, requireLookup = {}, globals = {}, debug = false) {
    const vm = QuickJS.newContext();
    let errorState = false;
    let lastError = "";
    let asyncProcessesRunning = 0;
    let beginAsyncProcess = () => {
        asyncProcessesRunning++;
    };
    let endAsyncProcess = () => {
        if (asyncProcessesRunning > 0) {
            asyncProcessesRunning--;
        }
    };
    let isAsyncProcessRunning = () => {
        //console.log("asyncProcessesRunning:", asyncProcessesRunning);
        return asyncProcessesRunning > 0;
    };
    // const assistantHandle = wrapObjectWhitelist(vm, apiObject, functionWhitelist, beginAsyncProcess, endAsyncProcess);
    // vm.setProp(vm.global, apiGlobalName, assistantHandle)
    // assistantHandle.dispose();
    const logHandle = vm.newFunction("log", (...args) => {
        const nativeArgs = args.map(vm.dump);
        console.log("QuickJS Log:", ...nativeArgs);
    });
    const consoleHandle = vm.newObject();
    const exportsHandle = vm.newObject();
    const errorHandle = vm.newFunction("error", (...args) => {
        try {
            const nativeArgs = args.map(vm.dump);
            console.log("QuickJS console.error:", ...nativeArgs);
            lastError = JSON.stringify(nativeArgs);
            errorState = true;
        }
        catch (e) {
            console.log("Error in error:", e);
        }
    });
    const globalNames = Object.getOwnPropertyNames(globals);
    for (let i = 0; i < globalNames.length; i++) {
        const globalOption = globals[globalNames[i]];
        const globalObj = globalOption.whitelist
            ? (0, sandbox_wrappers_1.wrapObjectWhitelist)(vm, globalOption.value, globalOption.whitelist, beginAsyncProcess, endAsyncProcess)
            : (0, sandbox_wrappers_1.wrap)(vm, globalOption.value, globalOption, beginAsyncProcess, endAsyncProcess);
        vm.setProp(vm.global, globalNames[i], globalObj);
        globalObj.dispose();
    }
    (0, sandbox_wrappers_1.injectTimingFunctions)(vm, beginAsyncProcess, endAsyncProcess);
    const requireHandle = vm.newFunction("require", (...args) => {
        const nativeArgs = args.map(vm.dump);
        if (requireLookup[nativeArgs[0]]) {
            const returnObj = (0, sandbox_wrappers_1.wrapObject)(vm, requireLookup[nativeArgs[0]], beginAsyncProcess, endAsyncProcess);
            return returnObj;
        }
        else {
            return vm.undefined;
        }
    });
    vm.setProp(consoleHandle, "log", logHandle);
    vm.setProp(consoleHandle, "error", errorHandle);
    vm.setProp(vm.global, "require", requireHandle);
    vm.setProp(vm.global, "console", consoleHandle);
    vm.setProp(vm.global, "exports", exportsHandle);
    consoleHandle.dispose();
    logHandle.dispose();
    exportsHandle.dispose();
    errorHandle.dispose();
    requireHandle.dispose();
    return {
        vm,
        getLastError: () => {
            return lastError;
        },
        isAsyncProcessRunning,
        runTask: (task) => {
            try {
                const compiled = tsCompile(task);
                if (!compiled || compiled.length === 0) {
                    console.error("Could not compile", task);
                    return false;
                }
                // View compiled typescript code for debugging
                // if(debug)
                //   console.log(compiled);
                errorState = false;
                const result = vm.evalCode(compiled);
                if (result.error) {
                    // log out the compiled program with line numbers
                    const lines = compiled.split("\n");
                    for (let i = 0; i < lines.length; i++) {
                        console.log(`${i + 1}: ${lines[i]}`);
                    }
                    console.log("Execution failed:", vm.dump(result.error));
                    result.error.dispose();
                    return false;
                }
                else {
                    //console.log("Task Result:", vm.dump(result.value));
                    result.value.dispose();
                    if (errorState) {
                        const lines = compiled.split("\n");
                        for (let i = 0; i < lines.length; i++) {
                            console.log(`${i + 1}: ${lines[i]}`);
                        }
                    }
                    return !errorState;
                }
            }
            catch (e) {
                console.log(e);
            }
            return false;
        },
    };
}
exports.default = createSandbox;
