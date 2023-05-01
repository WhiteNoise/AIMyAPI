import "quickjs-emscripten";

import * as ts from "typescript";
import {
  injectTimingFunctions,
  wrap,
  wrapObject,
  wrapObjectWhitelist,
} from "./sandbox-wrappers";

// Should we use "noEmitOnError": true ?
function tsCompile(
  source: string,
  options: ts.TranspileOptions = null
): string {
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

export interface GlobalOption {
  value: any;
  whitelist?: string[];
}

export interface Globals {
  [key: string]: GlobalOption;
}

// function whitelist can be produced using something like:
// const assistantFunctions =  Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject))
//   .filter((f) => f !== "constructor" && !f.startsWith("_"));

// Is there some way we can treat the API and globals the same?
// We could just provide an object for all globals (including the API) and also have the whitelist as a parameter..
export default async function createSandbox(QuickJS, requireLookup:any = {}, globals: Globals = {}, debug:boolean = false) {
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
    } catch (e) {
      console.log("Error in error:", e);
    }
  });

  const globalNames = Object.getOwnPropertyNames(globals);
  for (let i = 0; i < globalNames.length; i++) {
    const globalOption: GlobalOption = globals[globalNames[i]];
    const globalObj = globalOption.whitelist
      ? wrapObjectWhitelist(
          vm,
          globalOption.value,
          globalOption.whitelist,
          beginAsyncProcess,
          endAsyncProcess
        )
      : wrap(vm, globalOption.value, globalOption, beginAsyncProcess, endAsyncProcess);

    vm.setProp(vm.global, globalNames[i], globalObj);
    globalObj.dispose();
  }

  injectTimingFunctions(vm, beginAsyncProcess, endAsyncProcess);

  const requireHandle = vm.newFunction("require", (...args) => {
    const nativeArgs = args.map(vm.dump);
    if(requireLookup[nativeArgs[0] as string]) {
      const returnObj = wrapObject(vm, requireLookup[nativeArgs[0] as string], beginAsyncProcess, endAsyncProcess);
      return returnObj;
    } else {
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
    runTask: (task: string): boolean => {
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
        } else {
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
      } catch (e) {
        console.log(e);
      }

      return false;
    },
  };
}
