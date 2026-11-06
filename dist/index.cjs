'use strict';

var module$1 = require('module');
var fs = require('fs');
var openai$1 = require('openai');
var quickjsEmscripten = require('quickjs-emscripten');
var ts = require('typescript');
var zod = require('zod');
var path = require('path');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopNamespaceDefault(e) {
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n.default = e;
	return Object.freeze(n);
}

var ts__namespace = /*#__PURE__*/_interopNamespaceDefault(ts);

var require$1 = (
			false
				? /* @__PURE__ */ module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)))
				: require
		);

class Logger {
  constructor(debug = false) {
    this.logs = [];
    this.debug = false;
    this.debug = debug;
  }
  getLogs() {
    return this.logs;
  }
  addEntry(type, args, source) {
    if (Array.isArray(args)) {
      this.logs.push({ type, args, source });
    } else {
      this.logs.push({ type, args: [args], source });
    }
  }
  log(args, source) {
    this.addEntry("log", args, source);
    if (this.debug) {
      console.log(`[${source}]:`, ...args);
    }
  }
  trace(fnName, fnArgs, result) {
    this.logs.push({ type: "trace", fnName, fnArgs, result });
    if (this.debug) {
      console.debug(`[sandbox]: ${fnName}(${fnArgs.map((arg) => JSON.stringify(Logger.limitObjectForLogs(arg))).join(",")}) -> ${JSON.stringify(Logger.limitObjectForLogs(result))}`);
    }
  }
  error(args, source) {
    this.addEntry("error", args, source);
    if (this.debug) {
      console.error(`[${source}]:`, ...args);
    }
  }
  clear() {
    this.logs = [];
  }
  getPrettyLogs() {
    return this.logs.map((entry) => Logger.limitObjectForLogs(entry));
  }
  /**
   * Returns a trimmed copy of `value` that is safe to log.
   * - Objects/arrays nested deeper than `maxDepth` become "[Object]" / "[Array(n)]".
   * - Arrays longer than `maxArrayItems` keep the first items plus a "+N more items" string.
   * - Circular references become "[Circular]".
   */
  static limitObjectForLogs(value, maxDepth = 3, maxArrayItems = 5) {
    const seen = /* @__PURE__ */ new WeakSet();
    const trim = (val, depth) => {
      if (val === null || typeof val !== "object") {
        if (typeof val === "function") return `[Function${val.name ? `: ${val.name}` : ""}]`;
        if (typeof val === "bigint") return `${val}n`;
        if (typeof val === "symbol") return val.toString();
        return val;
      }
      if (val instanceof Date) return val.toISOString();
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (seen.has(val)) return "[Circular]";
      if (depth >= maxDepth) {
        return Array.isArray(val) ? `[Array(${val.length})]` : "[Object]";
      }
      seen.add(val);
      let result;
      if (Array.isArray(val)) {
        result = val.slice(0, maxArrayItems).map((item) => trim(item, depth + 1));
        if (val.length > maxArrayItems) {
          result.push(`+${val.length - maxArrayItems} more items`);
        }
      } else {
        result = {};
        for (const key of Object.keys(val)) {
          result[key] = trim(val[key], depth + 1);
        }
      }
      seen.delete(val);
      return result;
    };
    return trim(value, 0);
  }
}

let promiseId = 0;
let openPromises = {};
function wrapPromise(vm, promise, beginAsyncProcess, endAsyncProcess, logger) {
  promiseId += 1;
  const vmPromise = vm.newPromise();
  vmPromise._promiseId = promiseId;
  beginAsyncProcess();
  promise.then((...args) => {
    endAsyncProcess();
    const wrappedArgs = args.map((arg) => wrap(vm, arg, void 0, beginAsyncProcess, endAsyncProcess, logger));
    openPromises[vmPromise._promiseId] = null;
    vmPromise.resolve(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
  }).catch((error) => {
    vmPromise.reject(vm.newError(error?.message || "An error occurred"));
    openPromises[vmPromise._promiseId] = null;
  });
  vmPromise.settled.then(() => {
    endAsyncProcess();
    vm.runtime.executePendingJobs();
  });
  openPromises[promiseId] = vmPromise;
  return vmPromise.handle;
}
function rejectOpenPromises(vm) {
  for (const [id, promise] of Object.entries(openPromises)) {
    if (promise !== null) {
      promise.reject(vm.newError("Shutting down"));
      openPromises[id] = null;
    }
  }
  vm.runtime.executePendingJobs();
}
const isPromise = (value) => {
  return typeof value === "object" && typeof value.then === "function";
};
function wrap(vm, value, context, beginAsyncProcess, endAsyncProcess, logger) {
  if (value === null) {
    return null;
  } else if (isPromise(value)) {
    return wrapPromise(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (typeof value === "function") {
    return wrapGenericFunction(vm, value, context, beginAsyncProcess, endAsyncProcess, logger);
  } else if (Array.isArray(value)) {
    return wrapArray(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (value === null) {
    return vm.null;
  } else if (value instanceof Date) {
    const res = vm.evalCode(`new Date(${value.getTime()})`);
    return quickjsEmscripten.isSuccess(res) ? res.value : null;
  } else if (typeof value === "object") {
    return wrapObject(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (typeof value === "string") {
    return vm.newString(value);
  } else if (typeof value === "number") {
    return vm.newNumber(value);
  } else if (typeof value === "bigint") {
    return vm.newBigInt(value);
  } else if (typeof value === "boolean") {
    const res = vm.evalCode(value ? "true" : "false");
    return quickjsEmscripten.isSuccess(res) ? res.value : null;
  } else if (typeof value === "undefined") {
    return vm.undefined;
  } else {
    console.error("Unknown type", value);
    return null;
  }
}
function wrapObject(vm, obj, beginAsyncProcess, endAsyncProcess, logger) {
  const vmObject = vm.newObject();
  for (const [key, value] of Object.entries(obj)) {
    let wrappedValue = wrap(vm, value, obj, beginAsyncProcess, endAsyncProcess, logger);
    if (wrappedValue !== null) {
      vm.setProp(vmObject, key, wrappedValue);
      if (wrappedValue != vm.undefined && wrappedValue != vm.null && wrappedValue.dispose) {
        wrappedValue.dispose();
      }
    }
  }
  return vmObject;
}
function wrapObjectWhitelist(vm, obj, whitelist, beginAsyncProcess, endAsyncProcess, logger) {
  const vmObject = vm.newObject();
  whitelist.forEach((key) => {
    const value = obj[key];
    const wrappedValue = wrap(vm, value, obj, beginAsyncProcess, endAsyncProcess, logger);
    if (wrappedValue !== null) {
      vm.setProp(vmObject, key, wrappedValue);
      if (wrappedValue != vm.undefined && wrappedValue != vm.null && wrappedValue.dispose) {
        wrappedValue.dispose();
      }
    }
  });
  return vmObject;
}
function wrapArray(vm, arr, beginAsyncProcess, endAsyncProcess, logger) {
  const vmArray = vm.newArray();
  for (let i = 0; i < arr.length; i++) {
    let wrappedValue = wrap(vm, arr[i], arr, beginAsyncProcess, endAsyncProcess, logger);
    vm.setProp(vmArray, i, wrappedValue);
    if (wrappedValue != vm.undefined && wrappedValue != vm.null) {
      wrappedValue.dispose();
    }
  }
  return vmArray;
}
function validationDecorator(schema) {
  return function(...args) {
    let argumentObject = {};
    const params = Object.keys(schema.def.shape);
    args.forEach((value, index) => {
      if (index < params.length) {
        argumentObject[params[index]] = value;
      }
    });
    schema.parse(argumentObject);
  };
}
function wrapGenericFunction(vm, fn, context = void 0, beginAsyncProcess, endAsyncProcess, logger) {
  const vmFn = vm.newFunction(fn.name, (...args) => {
    const unwrappedArgs = args.map(vm.dump);
    try {
      const validatorName = `_params_${fn.name}`;
      const hasValidator = context != void 0 && validatorName in context && "parse" in context[validatorName];
      if (hasValidator) {
        const schema = context[validatorName];
        try {
          const validator = validationDecorator(schema);
          validator(...unwrappedArgs);
        } catch (e) {
          if (e instanceof zod.ZodError) {
            throw new Error(`Parameter validation failed for function "${fn.name}". Expected Parameters: [${Object.keys(schema.def.shape).join(",")}]. Errors:
${zod.z.prettifyError(e)}`);
          }
          throw new Error(`Parameter validation error calling ${fn.name}`);
        }
      }
      const result = fn.call(context, ...unwrappedArgs);
      logger.trace(fn.name, unwrappedArgs, result);
      const wrappedResult = wrap(vm, result, void 0, beginAsyncProcess, endAsyncProcess, logger);
      return wrappedResult;
    } catch (e) {
      logger.error([e], "sandbox");
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("An exception occurred calling " + fn.name);
    }
  });
  return vmFn;
}
function injectTimingFunctions(vm, cbAddedTimer, cbRemovedTimer, maxTimeout = 6e5) {
  const timeoutFunctionHandles = {};
  const _setTimeout = vm.newFunction("setTimeout", (vmFnHandle, timeoutHandle) => {
    const vmFnHandleCopy = vmFnHandle.dup();
    let timeout = vm.dump(timeoutHandle);
    if (timeout > maxTimeout) {
      timeout = maxTimeout;
    }
    cbAddedTimer();
    const timeoutID = setTimeout(() => {
      timeoutFunctionHandles[timeoutID.toString()] = null;
      cbRemovedTimer();
      vm.callFunction(vmFnHandleCopy, vm.undefined);
      vmFnHandleCopy.dispose();
      vm.runtime.executePendingJobs();
    }, timeout);
    timeoutFunctionHandles[timeoutID.toString()] = vmFnHandleCopy;
    return vm.newNumber(timeoutID);
  });
  vm.setProp(vm.global, "setTimeout", _setTimeout);
  _setTimeout.dispose();
  const intervalFunctionHandles = {};
  const _setInterval = vm.newFunction("setInterval", (vmFnHandle, timeoutHandle) => {
    const vmFnHandleCopy = vmFnHandle.dup();
    let timeout = vm.dump(timeoutHandle);
    if (timeout > maxTimeout) {
      timeout = maxTimeout;
    }
    const maxRepetitions = 99;
    let repetitions = 0;
    cbAddedTimer();
    const intervalId = setInterval(() => {
      repetitions += 1;
      intervalFunctionHandles[intervalId.toString()] = null;
      vm.callFunction(vmFnHandleCopy, vm.undefined);
      vm.runtime.executePendingJobs();
      if (repetitions > maxRepetitions) {
        console.log("Sandbox interval exceeded max repetitions");
        clearInterval(intervalId);
        cbRemovedTimer();
        return;
      }
    }, timeout);
    intervalFunctionHandles[intervalId.toString()] = vmFnHandleCopy;
    return vm.newNumber(intervalId);
  });
  vm.setProp(vm.global, "setInterval", _setInterval);
  _setInterval.dispose();
  const _clearTimeout = vm.newFunction("clearTimeout", (timeoutIdHandle) => {
    const timeoutId = vm.dump(timeoutIdHandle);
    const timeoutHandle = timeoutFunctionHandles[timeoutId.toString()];
    if (timeoutHandle) {
      cbRemovedTimer();
      timeoutHandle.dispose();
      clearTimeout(timeoutId);
    }
  });
  vm.setProp(vm.global, "clearTimeout", _clearTimeout);
  _clearTimeout.dispose();
  const _clearInterval = vm.newFunction("clearInterval", (intervalIdHandle) => {
    const intervalId = vm.dump(intervalIdHandle);
    const intervalHandle = intervalFunctionHandles[intervalId.toString()];
    if (intervalId) {
      cbRemovedTimer();
      intervalHandle.dispose();
      clearInterval(intervalId);
    }
  });
  vm.setProp(vm.global, "clearInterval", _clearInterval);
  _clearInterval.dispose();
}

function tsCompile(source, options) {
  if (!options) {
    options = {
      compilerOptions: {
        target: ts__namespace.ScriptTarget.ES2022,
        module: ts__namespace.ModuleKind.None
      }
    };
  }
  return ts__namespace.transpileModule(source, options).outputText;
}
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
    return asyncProcessesRunning > 0;
  };
  const logger = new Logger(debug);
  const logHandle = vm.newFunction("log", (...args) => {
    const nativeArgs = args.map(vm.dump);
    logger.log(nativeArgs, "sandbox");
  });
  const consoleHandle = vm.newObject();
  const exportsHandle = vm.newObject();
  const errorHandle = vm.newFunction("error", (...args) => {
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
    const globalOption = globals[globalNames[i]];
    const globalObj = globalOption.whitelist ? wrapObjectWhitelist(
      vm,
      globalOption.value,
      globalOption.whitelist,
      beginAsyncProcess,
      endAsyncProcess,
      logger
    ) : wrap(vm, globalOption.value, globalOption, beginAsyncProcess, endAsyncProcess, logger);
    vm.setProp(vm.global, globalNames[i], globalObj);
    globalObj.dispose();
  }
  injectTimingFunctions(vm, beginAsyncProcess, endAsyncProcess);
  const requireHandle = vm.newFunction("require", (...args) => {
    const nativeArgs = args.map(vm.dump);
    if (requireLookup[nativeArgs[0]]) {
      const returnObj = wrapObject(vm, requireLookup[nativeArgs[0]], beginAsyncProcess, endAsyncProcess, logger);
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
    checkCode: (code) => {
      logger.clear();
      try {
        const compiled = tsCompile(code);
        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.getLogs()
          };
        }
      } catch (e) {
        logger.error(["Error testing code:", e], "compiler");
        return {
          success: false,
          logs: logger.getLogs()
        };
      }
      return {
        success: true,
        logs: logger.getLogs()
      };
    },
    runCode: async (code) => {
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
        errorState = false;
        const result = vm.evalCode(compiled);
        if (result.error) {
          const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);
          logger.error(["Execution failed:", lines.join("\n"), vm.dump(result.error)], "runner");
          result.error.dispose();
          return {
            success: false,
            logs: logger.getPrettyLogs()
          };
        } else if ("value" in result) {
          const settled = vm.resolvePromise(result.value);
          result.value.dispose();
          vm.runtime.executePendingJobs();
          const promiseResult = await settled;
          if (promiseResult.error) {
            const err = vm.dump(promiseResult.error);
            promiseResult.error.dispose();
            const lines = compiled.split("\n").map((l, i) => `${i + 1}: ${l}`);
            logger.error(["Uncaught exception:", err, "\n", lines.join("\n")], "runner");
            return {
              success: false,
              logs: logger.getPrettyLogs()
            };
          }
          promiseResult.value.dispose();
          if (errorState) {
            const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);
            logger.error(["An error was reported during execution. Compiled code with line numbers:\n", lines.join("\n")], "runner");
          }
          return {
            success: !errorState,
            logs: logger.getPrettyLogs()
          };
        } else {
          logger.error(["Unknown execution result:", result], "runner");
          return {
            success: false,
            logs: logger.getPrettyLogs()
          };
        }
      } catch (e) {
        logger.error(["Error running code:", e], "runner");
      }
      return {
        success: false,
        logs: logger.getLogs()
      };
    }
  };
}

require$1("dotenv").config();
const openai = new openai$1.OpenAI({ baseURL: process.env.OPENAI_API_BASE_URL || void 0, apiKey: process.env.OPENAI_API_KEY || void 0 });
let QuickJS = null;
function createLog(message, source) {
  return { type: "log", args: [message], source };
}
const wrapCode = (apiGlobalName, apiFileDefPath, code) => `
(async () => {
${code}
})();        
`;
const wrapCodeBlock = (code, codeType = "") => `
\`\`\`${codeType}
${code}
\`\`\`
`;
function zodParseJSON(schema) {
  return (input) => schema.parse(JSON.parse(input));
}
function createBasePrompt(apiFilePath, apiGlobalName, documentationPath) {
  const apiText = fs.readFileSync(apiFilePath, "utf8");
  const documentationText = documentationPath ? fs.readFileSync(documentationPath, "utf8") : "";
  const createTaskPrompt = fs.readFileSync(path.resolve(__dirname, "../prompts/generate-code-prompt.md"), "utf8").replace("{{DOCUMENTATION}}", documentationText).replace("{{API}}", apiText).replace("{{API_GLOBAL_NAME}}", apiGlobalName || "");
  return createTaskPrompt;
}
const runCodeSchema = zod.z.object({
  code: zod.z.string()
});
const submitCodeSchema = zod.z.object({
  code: zod.z.string()
});
const generateCode = async function(instance, queryText, userChatHistory, createTaskPrompt, debug = false, hideLogsFromAgent = false, model = "gpt-5-mini", additionalModelOptions, attempt = 0) {
  let finalSubmittedCode = "";
  if (debug) {
    console.log("Generating code for query:", queryText);
  }
  const newHistoryItems = [];
  const codingTools = [
    {
      type: "function",
      function: {
        name: "runCode",
        // @ts-ignore
        function: async ({ code }) => {
          if (debug) {
            console.log("Running code...", code);
          }
          const checkRes = await instance.checkCode(code);
          if (!checkRes.success) {
            return {
              success: false,
              reason: "Code check failed",
              logs: checkRes.logs
            };
          }
          const res = await instance.runCode(code);
          if (hideLogsFromAgent) {
            res.logs = [];
          }
          return res;
        },
        description: "Check and run the provided code in a sandboxed environment. The code will have access to the API object. Returns the result of the code execution. Use this for testing and experimentation.",
        parse: zodParseJSON(runCodeSchema),
        parameters: runCodeSchema.toJSONSchema()
      }
    },
    // {
    //     type: "function",
    //     function: {
    //         name: "checkCode",
    //         // @ts-ignore
    //         function: async ({code}: {code: string}) => {   
    //             if(debug) {
    //                 console.log("Checking code...", code);                 
    //             }
    //             const res = await instance.checkCode(code);
    //             return res;
    //         },
    //         description: "Check the provided code for errors or issues without running it. Returns the result of the code check.",
    //         parse: zodParseJSON(checkCodeSchema),
    //         parameters: checkCodeSchema.toJSONSchema(),
    //     }
    // },        
    {
      type: "function",
      function: {
        name: "submitCode",
        // @ts-ignore
        function: async ({ code }) => {
          const checkRes = await instance.checkCode(code);
          if (!checkRes.success) {
            return {
              success: false,
              reason: "Code check failed",
              logs: checkRes.logs
            };
          }
          const res = await instance.runCode(code);
          if (hideLogsFromAgent) {
            res.logs = [];
          }
          if (res.success) {
            finalSubmittedCode = code;
          }
          return res;
        },
        description: "Submit the provided code as a candidate for the final code. The code will be checked and run and output logs and traces will be provided. Check the logs, if satisifed, respond to the user otherwise submit again.",
        parse: zodParseJSON(submitCodeSchema),
        parameters: submitCodeSchema.toJSONSchema()
      }
    }
  ];
  try {
    const runner = openai.chat.completions.runTools({
      model,
      messages: [
        {
          role: "system",
          content: "You will assist with writing or modifying code based on the user's request."
        },
        ...userChatHistory,
        {
          role: "user",
          content: attempt == 0 ? createTaskPrompt.replace("{{USER_QUERY}}", queryText) : queryText
        }
      ],
      tools: codingTools,
      ...additionalModelOptions
    }).on("message", async (message) => {
      if (debug) {
        if ("reasoning_content" in message) {
          console.log(message.reasoning_content);
        }
      }
      newHistoryItems.push(message);
    }).on("functionToolCall", (functionCall) => {
    }).on("functionToolCallResult", (functionCall) => {
    });
    const finalContent = await runner.finalContent();
    if (debug) {
      console.log("Generate code final response:", finalContent);
    }
    if (!finalSubmittedCode) {
      console.error("No code was submitted by the agent.");
      if (attempt < 3) {
        return generateCode(instance, `You must call submitCode with valid code before proceeding. Attempt ${attempt + 1} of 3.`, [
          ...userChatHistory,
          {
            role: "user",
            content: attempt == 0 ? createTaskPrompt.replace("{{USER_QUERY}}", queryText) : queryText
          },
          ...newHistoryItems
        ], createTaskPrompt, debug, hideLogsFromAgent, model, additionalModelOptions, attempt + 1);
      } else {
        return {
          success: false,
          comments: "No code was submitted by the agent after multiple attempts. Final comment: " + finalContent
        };
      }
    }
    return {
      success: true,
      code: finalSubmittedCode,
      comments: finalContent || void 0
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      comments: `Error generating code: ${err}`
    };
  }
};
async function createWithAPI(options) {
  const localOptions = {
    ...{
      apiGlobalName: "api",
      apiGlobals: {},
      apiWhitelist: Object.getOwnPropertyNames(Object.getPrototypeOf(options.apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_")),
      debug: false,
      model: process.env.OPENAI_API_MODEL || "gpt-5.4-mini",
      additionalModelOptions: {},
      hideLogsFromAgent: false
    },
    ...options
  };
  if (!localOptions.apiObject || !localOptions.apiDefFilePath) {
    throw new Error("apiObject and apiDefFilePath are required");
  }
  const { apiObject, apiWhitelist, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug, model, additionalModelOptions, hideLogsFromAgent } = localOptions;
  const createTaskPrompt = createBasePrompt(apiDefFilePath, apiGlobalName, apiDocsPath);
  const instance = {
    options: localOptions,
    generateCode: async function(queryText, userChatHistory, currentContext = void 0) {
      if (!queryText)
        return null;
      const formattedContext = wrapCodeBlock(JSON.stringify(currentContext, null, 2), "json");
      return await generateCode(
        instance,
        queryText,
        userChatHistory,
        createTaskPrompt.replace("{{CONTEXT}}", formattedContext),
        debug,
        hideLogsFromAgent,
        model,
        additionalModelOptions
      );
    },
    checkCode: async function(generatedCode) {
      if (!QuickJS) {
        if (debug)
          console.log("Creating quick.js");
        QuickJS = await quickjsEmscripten.getQuickJS();
      }
      let apiGlobals = {};
      if (options.apiGlobals) {
        for (const key in options.apiGlobals) {
          apiGlobals[key] = {
            value: options.apiGlobals[key]
          };
        }
      }
      const { vm, checkCode } = await createSandbox(QuickJS, apiExports ? {
        [apiDefFilePath]: apiExports
      } : void 0, {
        ...apiGlobals,
        [apiGlobalName]: {
          value: apiObject,
          whitelist: apiWhitelist
        }
      }, options.debug);
      try {
        if (debug) {
          console.log("checking Code:\n", generatedCode);
        }
        const res = await checkCode(wrapCode(apiGlobalName, apiDefFilePath, generatedCode));
        if (!res) {
          console.error("Unknown failure checking code");
          return {
            success: false,
            logs: [createLog("Unknown failure checking code", "compiler")]
          };
        }
        if (debug) {
          console.log(res.success ? "Code check passed" : "Code check failed");
        }
        if (res.success) {
          return {
            success: true,
            logs: [{ type: "log", args: ["\u2714\uFE0F Code check passed"], source: "compiler" }, ...res.logs]
          };
        }
        return {
          success: false,
          logs: [{ type: "error", args: ["\u274C Code check failed"], source: "compiler" }, ...res.logs]
        };
      } catch (err) {
        if (debug) {
          console.error("Error checking code:", err);
        }
      }
      vm.dispose();
      return {
        success: false,
        logs: []
      };
    },
    runCode: async function(code) {
      if (!QuickJS) {
        if (debug)
          console.log("Creating quick.js");
        QuickJS = await quickjsEmscripten.getQuickJS();
      }
      let apiGlobals = {};
      if (options.apiGlobals) {
        for (const key in options.apiGlobals) {
          apiGlobals[key] = {
            value: options.apiGlobals[key]
          };
        }
      }
      const { vm, runCode: sandbox_runCode, isAsyncProcessRunning } = await createSandbox(QuickJS, apiExports ? {
        [apiDefFilePath]: apiExports
      } : void 0, {
        ...apiGlobals,
        [apiGlobalName]: {
          value: apiObject,
          whitelist: apiWhitelist
        }
      }, options.debug);
      try {
        if (debug) {
          console.log("Running Code:\n", code);
        }
        const res = await sandbox_runCode(wrapCode(apiGlobalName, apiDefFilePath, code));
        if (!res) {
          console.error("Unknown failure running task");
          return {
            success: false,
            logs: []
          };
        }
        while (isAsyncProcessRunning()) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (debug) {
          console.log("Completed");
        }
        return res;
      } catch (err) {
        if (debug) {
          console.error("Error running task:", err);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      rejectOpenPromises(vm);
      vm.dispose();
      return {
        success: false,
        logs: []
      };
    },
    // generates code and runs it in one step
    processRequest: async function(userQuery, currentContext = void 0) {
      if (debug) {
        console.log("[debug] Query:", userQuery);
      }
      console.time("Generate Task");
      const prompt = createTaskPrompt.replace("{{CONTEXT}}", currentContext ? JSON.stringify(currentContext, null, 2) : "");
      const generatedCode = await generateCode(
        instance,
        userQuery,
        [],
        prompt,
        debug,
        hideLogsFromAgent,
        model,
        additionalModelOptions
      );
      console.timeEnd("Generate Task");
      console.log(`generated code result
Success?: ${generatedCode?.success}
Comments: ${generatedCode?.comments}
Running Code...`);
      console.time("Run Code took");
      if (generatedCode?.code) {
        const codeRunResult = await instance.runCode(generatedCode.code);
        if (!codeRunResult.success) {
          console.error("Error running generated code");
        }
      } else {
        console.error("No code generated", generatedCode);
      }
      console.timeEnd("Run Code took");
      return generatedCode;
    }
  };
  return instance;
}
const AIMyAPI = {
  // Standard way of using the library
  createWithAPI,
  // functions for customized usage
  createBasePrompt,
  generateCode,
  createSandbox
};

exports.AIMyAPI = AIMyAPI;
exports.Logger = Logger;
exports.createBasePrompt = createBasePrompt;
exports.generateCode = generateCode;
exports.zodParseJSON = zodParseJSON;
