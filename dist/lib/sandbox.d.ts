import "quickjs-emscripten";
export interface GlobalOption {
    value: any;
    whitelist?: string[];
}
export interface Globals {
    [key: string]: GlobalOption;
}
export default function createSandbox(QuickJS: any, requireLookup?: any, globals?: Globals, debug?: boolean): Promise<{
    vm: any;
    getLastError: () => string;
    isAsyncProcessRunning: () => boolean;
    runTask: (task: string) => boolean;
}>;
