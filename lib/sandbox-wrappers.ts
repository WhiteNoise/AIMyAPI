import "quickjs-emscripten";
import { QuickJSDeferredPromise } from "quickjs-emscripten";


let promiseId = 0;
let openPromises = {};

export function wrapPromise(vm, promise: Promise<any>, beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
  promiseId += 1;
 
  const vmPromise = vm.newPromise()
  vmPromise._promiseId = promiseId;
  beginAsyncProcess();
  promise.then((...args) => {
    //console.log("Promised resolved", args);
    endAsyncProcess();
    const wrappedArgs = args.map((arg) => wrap(vm, arg, undefined, beginAsyncProcess, endAsyncProcess));
    openPromises[vmPromise._promiseId] = null;
    vmPromise.resolve(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
  }).catch((...args) => {
    //console.log("Promised rejected", args);
    const wrappedArgs = args.map((arg) => wrap(vm, arg, undefined, beginAsyncProcess, endAsyncProcess));
    vmPromise.reject(...wrappedArgs);
    wrappedArgs.forEach((arg) => arg.dispose());
    openPromises[vmPromise._promiseId] = null;
  });
  vmPromise.settled.then( () => {
    endAsyncProcess();
    vm.runtime.executePendingJobs();
  })

  openPromises[promiseId] = vmPromise;

  return vmPromise.handle
}

export function rejectOpenPromises(vm) {
  for (const [id, promise ] of Object.entries(openPromises)) {
    if (promise !== null) {
      (promise as QuickJSDeferredPromise).reject(vm.newError("Shutting down"));
      openPromises[id] = null;
    }
  }

  vm.runtime.executePendingJobs();
}

export function wrap(vm, value: any, context: object,  beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
  if (value === null) {
    return null;
  } else if (typeof value === 'object' && typeof value.then === 'function') {
    //console.log("Wrapped promise");
    return wrapPromise(vm, value, beginAsyncProcess, endAsyncProcess);
  } else if (typeof value === "function") {
    //console.log("Wrapped function")
    return wrapGenericFunction(vm, value, context, beginAsyncProcess, endAsyncProcess);
  } else if (Array.isArray(value)) {
    //console.log("Wrapped array")
    return wrapArray(vm, value, beginAsyncProcess, endAsyncProcess);
  } else if (value === null) {
    //console.log("Wrapped null")
    return vm.null;
  } else if (typeof value === "object") {
    //console.log("Wrapped object")
    return wrapObject(vm, value, beginAsyncProcess, endAsyncProcess);
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
    return vm.evalCode(value ? "true" : "false").value;
  } else if (typeof value === "undefined") {
    return vm.undefined
  } else {
    return null
  }
}

export function wrapObject(vm, obj: any, beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
  const vmObject = vm.newObject();

  for (const [key, value] of Object.entries(obj)) {
    //console.log("wrapping", key, value)
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

export function wrapObjectWhitelist(vm, obj: any, whitelist: string[], beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
  const vmObject = vm.newObject();

  whitelist.forEach((key) => {
    const value = obj[key];
    //console.log("wrapping", key, value)
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

export function wrapArray(vm, arr: any[], beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
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

export function wrapGenericFunction(vm, fn: Function, context: object = undefined, beginAsyncProcess: () => void, endAsyncProcess: () => void): any {
  const vmFn = vm.newFunction(fn.name, (...args) => {
    const unwrappedArgs: any[] = args.map(vm.dump)
    //console.log("Wrapped function called", fn.name, unwrappedArgs )
    try {
      const result = fn.call(context, ...unwrappedArgs);
      //console.log("result", result);
      const wrappedResult = wrap(vm, result, undefined, beginAsyncProcess, endAsyncProcess);
      return wrappedResult;
    } catch (e) {
      console.log("Error", e);
    }

  });
  return vmFn;
}

export function injectTimingFunctions(vm, cbAddedTimer, cbRemovedTimer, maxTimeout = 600000): void {
  // Should we impose a limit on how long things can run for?
  const timeoutFunctionHandles = {};
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

    return vm.newNumber(timeoutID);
  });

  vm.setProp(vm.global, "setTimeout", _setTimeout);
  _setTimeout.dispose();
  const intervalFunctionHandles = {};
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