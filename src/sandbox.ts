import "quickjs-emscripten";

import { QuickJSWASMModule } from "quickjs-emscripten";
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
  options?: ts.TranspileOptions
): string {
  // Default options -- you could also perform a merge, or use the project tsconfig.json
  if (!options) {
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

export type SandboxLog = { 
  type: "log" | "error"; 
  args: any[]; 
  source: string 
};
export type CodeRunResult = {
  success: boolean;
  logs: SandboxLog[];
}
type LogSource = "sandbox" | "compiler" | "runner";
class Logger {
  logs: SandboxLog[] = [];
  debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }
  
  log(args: any, source: LogSource) {
    if(Array.isArray(args)) {
      this.logs.push({ type: "log", args, source });
    } else {      
      this.logs.push({ type: "log", args: [args], source });
    }
    if (this.debug) {
      console.log(`[${source}]:`, ...args);
    }
  }

  error(args: any, source: LogSource) {
    if(Array.isArray(args)) {
      this.logs.push({ type: "error", args, source });
    } else {
      this.logs.push({ type: "error", args: [args], source });
    }
    
    console.error(`[${source}]:`, ...args);
  }

  clear() {
    this.logs = [];
  }
}



// function whitelist can be produced using something like:
// const assistantFunctions =  Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject))
//   .filter((f) => f !== "constructor" && !f.startsWith("_"));

// Is there some way we can treat the API and globals the same?
// We could just provide an object for all globals (including the API) and also have the whitelist as a parameter..
export default async function createSandbox(QuickJS: QuickJSWASMModule, requireLookup:any = {}, globals: Globals = {}, debug:boolean = false) {
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
    // make sure code passes the typescript compilation
    checkCode: (code: string) => {
      logger.clear();
      try {
        const compiled = tsCompile(code);
        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.logs,
          };
        }        
      } catch (e) {
        logger.error(["Error testing code:", e], "compiler");
        return {
          success: false,
          logs: logger.logs,
        };
      }

      return {
        success: true,
        logs: logger.logs,
      }
    },
    runCode: (code: string): CodeRunResult => {
      try {
        logger.clear();
        const compiled = tsCompile(code);

        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.logs,
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
            logs: logger.logs,
          };
        } else if("value" in result){
          //console.log("Task Result:", vm.dump(result.value));

          result.value.dispose();

          
          if (errorState) {
            const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);
            logger.error(["An error was reported during execution. Compiled code with line numbers:", lines.join("\n")], "runner");
          }

          return {
            success: !errorState,
            logs: logger.logs,
          };
        } else {
          logger.error(["Unknown execution result:", result], "runner");
          return {
            success: false,
            logs: logger.logs,
          };
        }
      } catch (e) {
        logger.error(["Error running code:", e], "runner");
      }

      return {
        success: false,
        logs: logger.logs,
      };
    },
  };
}
