import "quickjs-emscripten";
export declare function wrapPromise(vm: any, promise: Promise<any>, beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function rejectOpenPromises(vm: any): void;
export declare function wrap(vm: any, value: any, context: object, beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function wrapObject(vm: any, obj: any, beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function wrapObjectWhitelist(vm: any, obj: any, whitelist: string[], beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function wrapArray(vm: any, arr: any[], beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function wrapGenericFunction(vm: any, fn: Function, context: object, beginAsyncProcess: () => void, endAsyncProcess: () => void): any;
export declare function injectTimingFunctions(vm: any, cbAddedTimer: any, cbRemovedTimer: any, maxTimeout?: number): void;
