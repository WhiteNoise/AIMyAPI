import "quickjs-emscripten";

import { QuickJSWASMModule } from "quickjs-emscripten";
import * as ts from "typescript";
import { Logger, SandboxLogEntry } from "./logger";
import {
  injectTimingFunctions,
  wrap,
  wrapObject,
  wrapObjectWhitelist,
} from "./sandbox-wrappers";

// linting: https://eslint.org/docs/latest/integrate/nodejs-api#linter

// Should we use "noEmitOnError": true ?
function tsCompile(
  source: string,
  options?: ts.TranspileOptions
): string {
  // Default options -- you could also perform a merge, or use the project tsconfig.json
  if (!options) {
    options = {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
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
export type CodeRunResult = {
  success: boolean;
  logs: SandboxLogEntry[];
}


// function whitelist can be produced using something like:
// const assistantFunctions =  Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject))
//   .filter((f) => f !== "constructor" && !f.startsWith("_"));

// Is there some way we can treat the API and globals the same?
// We could just provide an object for all globals (including the API) and also have the whitelist as a parameter..
export default async function createSandbox(QuickJS: QuickJSWASMModule, requireLookup:any = {}, globals: Globals = {}, debug:boolean = false, limitLogs: boolean = true) {
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

  const logger = new Logger(debug);



  // const assistantHandle = wrapObjectWhitelist(vm, apiObject, functionWhitelist, beginAsyncProcess, endAsyncProcess);
  // vm.setProp(vm.global, apiGlobalName, assistantHandle)

  // assistantHandle.dispose();

  const logHandle = vm.newFunction("log", (...args:any) => {
    const nativeArgs = args.map(vm.dump);
    logger.log(nativeArgs, "sandbox");
  });
  const consoleHandle = vm.newObject();
  const exportsHandle = vm.newObject();

  const errorHandle = vm.newFunction("error", (...args:any) => {
    try {
      const nativeArgs = args.map(vm.dump);

      logger.error(nativeArgs, "sandbox");
      lastError = JSON.stringify(nativeArgs);
      errorState = true;
    } catch (e) {
      logger.error(["? Error in error:", e], "sandbox");
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
          endAsyncProcess,
          logger
        )
      : wrap(vm, globalOption.value, globalOption, beginAsyncProcess, endAsyncProcess, logger);

    vm.setProp(vm.global, globalNames[i], globalObj);
    globalObj.dispose();
  }

  injectTimingFunctions(vm, beginAsyncProcess, endAsyncProcess);

  const requireHandle = vm.newFunction("require", (...args) => {
    const nativeArgs = args.map(vm.dump);
    if(requireLookup[nativeArgs[0] as string]) {
      const returnObj = wrapObject(vm, requireLookup[nativeArgs[0] as string], beginAsyncProcess, endAsyncProcess, logger);
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
    // make sure code passes the typescript compilation
    checkCode: (code: string) => {
      logger.clear();
      try {
        const compiled = tsCompile(code);
        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.getLogs(),
          };
        }        
      } catch (e) {
        logger.error(["Error testing code:", e], "compiler");
        return {
          success: false,
          logs: logger.getLogs(),
        };
      }

      return {
        success: true,
        logs: logger.getLogs(),
      }
    },
    runCode: async (code: string): Promise<CodeRunResult> => {
      try {
        logger.clear();
        const compiled = tsCompile(code);

        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.getLogs()
          };
        }

        // View compiled typescript code for debugging
        // if(debug)
        //   console.log(compiled);

        errorState = false;
        const result = vm.evalCode(compiled);

        if (result.error) {
          // log out the compiled program with line numbers
          const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);

          logger.error(["Execution failed:", lines.join("\n"), vm.dump(result.error)], "runner");

          result.error.dispose();
          return {
            success: false,
            logs: limitLogs ? logger.getPrettyLogs() : logger.getLogs(),
          };
        } else if("value" in result) {
          //console.log("Task Result:", vm.dump(result.value), errorState);
        // The wrapped code returns a promise; wait for it to settle.
          const settled = vm.resolvePromise(result.value);
          result.value.dispose();
          vm.runtime.executePendingJobs();   // start the async function running
          const promiseResult = await settled;

          if (promiseResult.error) {
            const err = vm.dump(promiseResult.error);
            promiseResult.error.dispose();
            const lines = compiled.split("\n").map((l, i) => `${i + 1}: ${l}`);
            logger.error(["Uncaught exception:", err, "\n", lines.join("\n")], "runner");
            return { 
              success: false, 
              logs: limitLogs ? logger.getPrettyLogs() : logger.getLogs(),
            };
          }
          // @ts-ignore this is a success response
          promiseResult.value.dispose();
          
          

          if (errorState) {
            const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);
            logger.error(["An error was reported during execution. Compiled code with line numbers:\n", lines.join("\n")], "runner");
          }

          return {
            success: !errorState,
            logs: limitLogs ? logger.getPrettyLogs() : logger.getLogs(),
          };
        } else {
          logger.error(["Unknown execution result:", result], "runner");
          return {
            success: false,
            logs: limitLogs ? logger.getPrettyLogs() : logger.getLogs(),
          };
        }
      } catch (e) {
        logger.error(["Error running code:", e], "runner");
      }

      return {
        success: false,
        logs: logger.getLogs(),
      };
    },
  };
}
