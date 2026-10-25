import "quickjs-emscripten";
import { isSuccess, QuickJSContext, QuickJSDeferredPromise } from "quickjs-emscripten";
import { z, ZodError, ZodObject } from "zod";
import { Logger } from "./logger";

type QuickJSPromiseWithId = QuickJSDeferredPromise & { _promiseId: number };

let promiseId = 0;
let openPromises: Record<number, QuickJSPromiseWithId | null> = {};

export function wrapPromise(vm: QuickJSContext, promise: Promise<any>, beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
  promiseId += 1;
 
  const vmPromise = vm.newPromise() as QuickJSPromiseWithId
  vmPromise._promiseId = promiseId;
  beginAsyncProcess();
  promise.then((...args) => {
    //console.log("Promised resolved", args);
    endAsyncProcess();
    const wrappedArgs = args.map((arg) => wrap(vm, arg, undefined, beginAsyncProcess, endAsyncProcess, logger));
    openPromises[vmPromise._promiseId] = null;
    vmPromise.resolve(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
  }).catch(error => {   
    vmPromise.reject(vm.newError(error?.message || "An error occurred"));

    openPromises[vmPromise._promiseId] = null;
  });
  vmPromise.settled.then( () => {
    endAsyncProcess();
    vm.runtime.executePendingJobs();
  })

  openPromises[promiseId] = vmPromise;

  return vmPromise.handle
}

export function rejectOpenPromises(vm: QuickJSContext) {
  for (const [id, promise ] of Object.entries(openPromises)) {
    if (promise !== null) {
      (promise as QuickJSDeferredPromise).reject(vm.newError("Shutting down"));
      openPromises[id as unknown as number] = null;
    }
  }

  vm.runtime.executePendingJobs();
}

const isPromise = (value: any) => { return (typeof value === 'object' && typeof value.then === 'function') };

// Value - member variable to wrap
// context - owning object
export function wrap(vm: QuickJSContext, value: any, context: object | undefined,  beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
  if (value === null) {

    return null;
  } else if (isPromise(value)) {
    return wrapPromise(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (typeof value === "function") {
    //console.log("Wrapped function")
    return wrapGenericFunction(vm, value, context, beginAsyncProcess, endAsyncProcess, logger);
  } else if (Array.isArray(value)) {
    //console.log("Wrapped array")
    return wrapArray(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (value === null) {
    //console.log("Wrapped null")
    return vm.null;
  } else if (value instanceof Date) {
    const res = vm.evalCode(`new Date(${value.getTime()})`);
    return isSuccess(res) ? res.value : null;
  } else if (typeof value === "object") {
    //console.log("Wrapped object")
    return wrapObject(vm, value, beginAsyncProcess, endAsyncProcess, logger);
  } else if (typeof value === "string") {
    //console.log("Wrapped string")
    return vm.newString(value)
  } else if (typeof value === "number") {
    //console.log("Wrapped number")
    return vm.newNumber(value);
  } else if (typeof value === "bigint") {
    //console.log("Wrapped bigint")
    return vm.newBigInt(value);
  } else if (typeof value === "boolean") {
    // since there is no newBoolean, we have to do this
    const res = vm.evalCode(value ? "true" : "false")
    return isSuccess(res) ? res.value : null;
  } else if (typeof value === "undefined") {
    return vm.undefined
  } else {
    console.error("Unknown type", value)
    return null
  }
}

export function wrapObject(vm: QuickJSContext, obj: any, beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
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

export function wrapObjectWhitelist(vm: QuickJSContext, obj: any, whitelist: string[], beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
  const vmObject = vm.newObject();

  whitelist.forEach((key) => {
      // console.log("wrapping", key, value)
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

export function wrapArray(vm: QuickJSContext, arr: any[], beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
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

function validationDecorator(schema: ZodObject) {
  return function(...args: unknown[]) {
    let argumentObject: Record<string, unknown> = {};
    const params = Object.keys(schema.def.shape);
    args.forEach((value, index) => {
      if(index < params.length) {
        argumentObject[params[index]] = value;
      }
    });

    schema.parse(argumentObject);
  }
}

export function wrapGenericFunction(vm: QuickJSContext, fn: Function, context: object | undefined = undefined, beginAsyncProcess: () => void, endAsyncProcess: () => void, logger: Logger): any {
  const vmFn = vm.newFunction(fn.name, (...args) => {
    const unwrappedArgs: any[] = args.map(vm.dump)
    //console.log("Wrapped function called", fn.name, unwrappedArgs )
    try {
      const validatorName = `_params_${fn.name}`;
      const hasValidator = context != undefined && validatorName in context && "parse" in (context as Record<string, any>)[validatorName];
    
      if(hasValidator) {
        const schema = (context as Record<string, ZodObject>)[validatorName];
        try {
          const validator = validationDecorator(schema);
          validator(...unwrappedArgs);    // will throw if validation fails
        } catch(e) {
          // Throwing (not vm.throw) is how a host function raises an exception in the VM;
          // newFunction catches it and turns it into a sandbox exception.
          if(e instanceof ZodError) {
            throw new Error(`Parameter validation failed for function "${fn.name}". Expected Parameters: [${Object.keys(schema.def.shape).join(",")}]. Errors:\n${z.prettifyError(e)}`);
          }
          throw new Error(`Parameter validation error calling ${fn.name}`);
        }
      }

      const result = fn.call(context, ...unwrappedArgs);

      logger.trace(fn.name, unwrappedArgs, result);

      const wrappedResult = wrap(vm, result, undefined, beginAsyncProcess, endAsyncProcess, logger);
      return wrappedResult;
    } catch (e: any) {
      logger.error([e], "sandbox");
      if(e instanceof Error) {
        throw e;
      }
      throw new Error("An exception occurred calling " + fn.name);
    }

  });
  return vmFn;
}

export function injectTimingFunctions(vm: QuickJSContext, cbAddedTimer: () => void, cbRemovedTimer: () => void, maxTimeout = 600000): void {
  // Should we impose a limit on how long things can run for?
  const timeoutFunctionHandles: any = {};
  const _setTimeout = vm.newFunction("setTimeout", (vmFnHandle, timeoutHandle) => {
    // Make a copy because otherwise vmFnHandle does not live long enough to call after the timeout
    const vmFnHandleCopy = vmFnHandle.dup()
    let timeout = vm.dump(timeoutHandle)

    // cap timeout at max timeout
    if(timeout > maxTimeout) {
      timeout = maxTimeout;
    }

    // console.log("Sandbox calling timeout for: " + timeout);
    cbAddedTimer();
    const timeoutID = setTimeout(() => {
      timeoutFunctionHandles[timeoutID.toString()] = null;
      // callFunction(vmFnHandleCopy) will call the vm function
      // in the context of the vm
      // we pass vm.undefined because we need to pass something for the "this" argument
      //console.log("Sandbox called timeout function")
      cbRemovedTimer();
      vm.callFunction(vmFnHandleCopy, vm.undefined)
      vmFnHandleCopy.dispose()
      vm.runtime.executePendingJobs();
    }, timeout)
    timeoutFunctionHandles[timeoutID.toString()] = vmFnHandleCopy;

    return vm.newNumber(timeoutID as unknown as number);
  });

  vm.setProp(vm.global, "setTimeout", _setTimeout);
  _setTimeout.dispose();
  const intervalFunctionHandles: any = {};
  const _setInterval = vm.newFunction("setInterval", (vmFnHandle, timeoutHandle) => {
    // Make a copy because otherwise vmFnHandle does not live long enough to call after the timeout
    const vmFnHandleCopy = vmFnHandle.dup()
    let timeout = vm.dump(timeoutHandle)

    // cap timeout at max timeout
    if(timeout > maxTimeout) {
      timeout = maxTimeout;
    }

    //console.log("Sandbox calling interval for: " + timeout);
    const maxRepetitions = 99;
    let repetitions = 0;
    cbAddedTimer();
    const intervalId = setInterval(() => {
      repetitions += 1;
      intervalFunctionHandles[intervalId.toString()] = null


      // callFunction(vmFnHandleCopy) will call the vm function
      // in the context of the vm
      // we pass vm.undefined because we need to pass something for the "this" argument
      vm.callFunction(vmFnHandleCopy, vm.undefined)
      vm.runtime.executePendingJobs();

      if (repetitions > maxRepetitions) {
        console.log("Sandbox interval exceeded max repetitions");
        clearInterval(intervalId);
        cbRemovedTimer();
        return;
      }
    }, timeout);
    intervalFunctionHandles[intervalId.toString()] = vmFnHandleCopy;

    return vm.newNumber(intervalId as unknown as number);
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