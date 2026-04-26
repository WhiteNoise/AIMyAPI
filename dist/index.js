'use strict';

var module$1 = require('module');
var fs = require('fs');
var openai$1 = require('openai');
var path = require('path');
var quickjsEmscripten = require('quickjs-emscripten');
var ts = require('typescript');
var zod = require('zod');
var zodToJsonSchema = require('zod-to-json-schema');

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
				? /* @__PURE__ */ module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('index.js', document.baseURI).href)))
				: require
		);

let promiseId = 0;
let openPromises = {};
function wrapPromise(vm, promise, beginAsyncProcess, endAsyncProcess) {
  promiseId += 1;
  const vmPromise = vm.newPromise();
  vmPromise._promiseId = promiseId;
  beginAsyncProcess();
  promise.then((...args) => {
    endAsyncProcess();
    const wrappedArgs = args.map((arg) => wrap(vm, arg, void 0, beginAsyncProcess, endAsyncProcess));
    openPromises[vmPromise._promiseId] = null;
    vmPromise.resolve(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
  }).catch((...args) => {
    const wrappedArgs = args.map((arg) => wrap(vm, arg, void 0, beginAsyncProcess, endAsyncProcess));
    vmPromise.reject(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
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
function wrap(vm, value, context, beginAsyncProcess, endAsyncProcess) {
  if (value === null) {
    return null;
  } else if (typeof value === "object" && typeof value.then === "function") {
    return wrapPromise(vm, value, beginAsyncProcess, endAsyncProcess);
  } else if (typeof value === "function") {
    return wrapGenericFunction(vm, value, context, beginAsyncProcess, endAsyncProcess);
  } else if (Array.isArray(value)) {
    return wrapArray(vm, value, beginAsyncProcess, endAsyncProcess);
  } else if (value === null) {
    return vm.null;
  } else if (typeof value === "object") {
    return wrapObject(vm, value, beginAsyncProcess, endAsyncProcess);
  } else if (typeof value === "string") {
    return vm.newString(value);
  } else if (typeof value === "number") {
    return vm.newNumber(value);
  } else if (typeof value === "bigint") {
    return vm.newBigInt(value);
  } else if (typeof value === "boolean") {
    return vm.evalCode(value ? "true" : "false").value;
  } else if (typeof value === "undefined") {
    return vm.undefined;
  } else {
    return null;
  }
}
function wrapObject(vm, obj, beginAsyncProcess, endAsyncProcess) {
  const vmObject = vm.newObject();
  for (const [key, value] of Object.entries(obj)) {
    let wrappedValue = wrap(vm, value, obj, beginAsyncProcess, endAsyncProcess);
    if (wrappedValue !== null) {
      vm.setProp(vmObject, key, wrappedValue);
      if (wrappedValue != vm.undefined && wrappedValue != vm.null && wrappedValue.dispose) {
        wrappedValue.dispose();
      }
    }
  }
  return vmObject;
}
function wrapObjectWhitelist(vm, obj, whitelist, beginAsyncProcess, endAsyncProcess) {
  const vmObject = vm.newObject();
  whitelist.forEach((key) => {
    const value = obj[key];
    const wrappedValue = wrap(vm, value, obj, beginAsyncProcess, endAsyncProcess);
    if (wrappedValue !== null) {
      vm.setProp(vmObject, key, wrappedValue);
      if (wrappedValue != vm.undefined && wrappedValue != vm.null && wrappedValue.dispose) {
        wrappedValue.dispose();
      }
    }
  });
  return vmObject;
}
function wrapArray(vm, arr, beginAsyncProcess, endAsyncProcess) {
  const vmArray = vm.newArray();
  for (let i = 0; i < arr.length; i++) {
    let wrappedValue = wrap(vm, arr[i], arr, beginAsyncProcess, endAsyncProcess);
    vm.setProp(vmArray, i, wrappedValue);
    if (wrappedValue != vm.undefined && wrappedValue != vm.null) {
      wrappedValue.dispose();
    }
  }
  return vmArray;
}
function wrapGenericFunction(vm, fn, context = void 0, beginAsyncProcess, endAsyncProcess) {
  const vmFn = vm.newFunction(fn.name, (...args) => {
    const unwrappedArgs = args.map(vm.dump);
    try {
      const result = fn.call(context, ...unwrappedArgs);
      const wrappedResult = wrap(vm, result, void 0, beginAsyncProcess, endAsyncProcess);
      return wrappedResult;
    } catch (e) {
      console.log("Error", e);
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
        target: ts__namespace.ScriptTarget.ES2020,
        module: ts__namespace.ModuleKind.None
      }
    };
  }
  return ts__namespace.transpileModule(source, options).outputText;
}
class Logger {
  constructor(debug = false) {
    this.logs = [];
    this.debug = false;
    this.debug = debug;
  }
  log(args, source) {
    if (Array.isArray(args)) {
      this.logs.push({ type: "log", args, source });
    } else {
      this.logs.push({ type: "log", args: [args], source });
    }
    if (this.debug) {
      console.log(`[${source}]:`, ...args);
    }
  }
  error(args, source) {
    if (Array.isArray(args)) {
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
      endAsyncProcess
    ) : wrap(vm, globalOption.value, globalOption, beginAsyncProcess, endAsyncProcess);
    vm.setProp(vm.global, globalNames[i], globalObj);
    globalObj.dispose();
  }
  injectTimingFunctions(vm, beginAsyncProcess, endAsyncProcess);
  const requireHandle = vm.newFunction("require", (...args) => {
    const nativeArgs = args.map(vm.dump);
    if (requireLookup[nativeArgs[0]]) {
      const returnObj = wrapObject(vm, requireLookup[nativeArgs[0]], beginAsyncProcess, endAsyncProcess);
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
            logs: logger.logs
          };
        }
      } catch (e) {
        logger.error(["Error testing code:", e], "compiler");
        return {
          success: false,
          logs: logger.logs
        };
      }
      return {
        success: true,
        logs: logger.logs
      };
    },
    runCode: (code) => {
      try {
        logger.clear();
        const compiled = tsCompile(code);
        if (!compiled || compiled.length === 0) {
          logger.error(["Could not compile:", code], "compiler");
          return {
            success: false,
            logs: logger.logs
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
            logs: logger.logs
          };
        } else if ("value" in result) {
          result.value.dispose();
          if (errorState) {
            const lines = compiled.split("\n").map((line, index) => `${index + 1}: ${line}`);
            logger.error(["An error was reported during execution. Compiled code with line numbers:", lines.join("\n")], "runner");
          }
          return {
            success: !errorState,
            logs: logger.logs
          };
        } else {
          logger.error(["Unknown execution result:", result], "runner");
          return {
            success: false,
            logs: logger.logs
          };
        }
      } catch (e) {
        logger.error(["Error running code:", e], "runner");
      }
      return {
        success: false,
        logs: logger.logs
      };
    }
  };
}

require$1("dotenv").config();
const openai = new openai$1.OpenAI();
const wrapCode = (apiGlobalName, apiFileDefPath, code) => `
(async () => {
    try {
        ${code}
    } catch(err) { 
        console.error(err); 
    }
})();        
`;
function zodParseJSON(schema) {
  return (input) => schema.parse(JSON.parse(input));
}
function createBasePrompt(apiFilePath, apiGlobalName, documentationPath) {
  const apiText = fs.readFileSync(apiFilePath, "utf8");
  const documentationText = documentationPath ? fs.readFileSync(documentationPath, "utf8") : "";
  const createTaskPrompt = fs.readFileSync(path.join(__dirname, "../prompts/create-task-prompt.md"), "utf8").replace("{{DOCUMENTATION}}", documentationText).replace("{{API}}", apiText).replace("{{API_GLOBAL_NAME}}", apiGlobalName || "");
  return createTaskPrompt;
}
const runCodeSchema = zod.z.object({
  code: zod.z.string()
});
const checkCodeSchema = zod.z.object({
  code: zod.z.string()
});
const submitCodeSchema = zod.z.object({
  code: zod.z.string()
});
const generateCode = async function(instance, queryText, userChatHistory, createTaskPrompt, debug = false, model = "gpt-5-mini", additionalModelOptions) {
  let finalSubmittedCode = "";
  if (debug) {
    console.log("Generating code for query:", queryText);
  }
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
          const res = await instance.runCode(code);
          return res;
        },
        description: "Run the provided code in a sandboxed environment. The code will have access to the API object. Returns the result of the code execution.",
        parse: zodParseJSON(runCodeSchema),
        parameters: zodToJsonSchema.zodToJsonSchema(runCodeSchema)
      }
    },
    {
      type: "function",
      function: {
        name: "checkCode",
        // @ts-ignore
        function: async ({ code }) => {
          if (debug) {
            console.log("Checking code...", code);
          }
          const res = await instance.checkCode(code);
          return res;
        },
        description: "Check the provided code for errors or issues without running it. Returns the result of the code check.",
        parse: zodParseJSON(checkCodeSchema),
        parameters: zodToJsonSchema.zodToJsonSchema(checkCodeSchema)
      }
    },
    {
      type: "function",
      function: {
        name: "submitCode",
        // @ts-ignore
        function: async ({ code }) => {
          finalSubmittedCode = code;
          return {
            success: true
          };
        },
        description: "Submit the provided code as the final code to run. This will end the code generation process and the code will be run in the sandbox. Use this when you are confident in the code you have generated and want to run it.",
        parse: zodParseJSON(submitCodeSchema),
        parameters: zodToJsonSchema.zodToJsonSchema(submitCodeSchema)
      }
    }
  ];
  try {
    const runner = openai.chat.completions.runTools({
      model,
      messages: [
        {
          role: "system",
          content: "You will assist with writing code to perform the user's request."
        },
        ...userChatHistory,
        {
          role: "user",
          content: createTaskPrompt.replace("{{USER_QUERY}}", queryText)
        }
      ],
      tools: codingTools,
      ...additionalModelOptions
    }).on("message", async (message) => {
      if (debug) {
        console.log("Message:", JSON.stringify(message, null, 2));
      }
    }).on("functionToolCall", (functionCall) => {
      if (debug) {
        console.log("Function Call:", JSON.stringify(functionCall, null, 2));
      }
    }).on("functionToolCallResult", (functionCall) => {
      if (debug) {
        console.log("Function Call Result:", JSON.stringify(functionCall, null, 2));
      }
    });
    const finalContent = await runner.finalContent();
    if (debug) {
      console.log("Final Content:", finalContent);
    }
    return {
      code: finalSubmittedCode,
      comments: finalContent || void 0
    };
  } catch (err) {
    console.error(err);
    return null;
  }
};
let QuickJS = null;
async function createWithAPI(options) {
  options = {
    apiGlobalName: "api",
    apiGlobals: {},
    apiWhitelist: Object.getOwnPropertyNames(Object.getPrototypeOf(options.apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_")),
    debug: false,
    model: process.env.OPENAI_API_MODEL || "gpt-5.4-mini",
    additionalModelOptions: {},
    ...options
  };
  if (!options.apiObject || !options.apiDefFilePath || !options.apiGlobalName) {
    throw new Error("apiObject, apiFilePath, and apiGlobalName are required");
  }
  const { apiObject, apiWhitelist, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug, model, additionalModelOptions } = options;
  const createTaskPrompt = createBasePrompt(apiDefFilePath, apiGlobalName, apiDocsPath);
  const instance = {
    options,
    generateCode: async function(queryText, userChatHistory, currentContext = void 0) {
      if (!queryText)
        return null;
      const formattedContext = currentContext ? "```json\n" + JSON.stringify(currentContext, null, 2) + "```" : "";
      return await generateCode(instance, queryText, userChatHistory, createTaskPrompt.replace("{{CONTEXT}}", formattedContext), debug, model, additionalModelOptions);
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
      const { vm, checkCode } = await createSandbox(QuickJS, {
        [apiDefFilePath]: apiExports
      }, {
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
            logs: []
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
      const { vm, runCode: runTask, isAsyncProcessRunning } = await createSandbox(QuickJS, {
        [apiDefFilePath]: apiExports
      }, {
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
        const res = await runTask(wrapCode(apiGlobalName, apiDefFilePath, code));
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
    processRequest: async function(userQuery, currentContext = void 0) {
      if (debug) {
        console.log("Query:", userQuery);
      }
      console.time("Generate Task");
      const generatedCode = await generateCode(instance, userQuery, [], createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```json\n" + JSON.stringify(currentContext, null, 2) + "```" : ""), debug, model, additionalModelOptions);
      console.timeEnd("Generate Task");
      console.time("Run Code");
      if (generatedCode?.code) {
        await instance.runCode(generatedCode.code);
      } else {
        console.error("No code generated", generatedCode);
      }
      console.timeEnd("Run Code");
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
exports.createBasePrompt = createBasePrompt;
exports.generateCode = generateCode;
exports.zodParseJSON = zodParseJSON;
