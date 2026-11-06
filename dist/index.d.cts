import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { QuickJSWASMModule } from 'quickjs-emscripten';

type LogSource = "sandbox" | "compiler" | "runner";
type LogEntryType = "log" | "error" | "trace";
type SandboxTrace = {
    type: "trace";
    fnName: string;
    fnArgs: any[];
    result: any;
};
type SandboxLogOrError = {
    type: "log" | "error";
    args: any[];
    source: LogSource;
};
type SandboxLogEntry = SandboxLogOrError | SandboxTrace;
declare class Logger {
    private logs;
    debug: boolean;
    constructor(debug?: boolean);
    getLogs(): SandboxLogEntry[];
    addEntry(type: "log" | "error", args: any, source: LogSource): void;
    log(args: any, source: LogSource): void;
    trace(fnName: string, fnArgs: any[], result: any): void;
    error(args: any, source: LogSource): void;
    clear(): void;
    getPrettyLogs(): any[];
    /**
     * Returns a trimmed copy of `value` that is safe to log.
     * - Objects/arrays nested deeper than `maxDepth` become "[Object]" / "[Array(n)]".
     * - Arrays longer than `maxArrayItems` keep the first items plus a "+N more items" string.
     * - Circular references become "[Circular]".
     */
    static limitObjectForLogs(value: any, maxDepth?: number, maxArrayItems?: number): any;
}

interface GlobalOption {
    value: any;
    whitelist?: string[];
}
interface Globals {
    [key: string]: GlobalOption;
}
type CodeRunResult = {
    success: boolean;
    logs: SandboxLogEntry[];
};

interface AIMyAPIOptions {
    apiObject: object;
    apiExports?: object;
    apiWhitelist?: string[];
    apiGlobals?: object;
    apiDefFilePath: string;
    apiGlobalName?: string;
    apiDocsPath?: string;
    debug?: boolean;
    model?: string;
    additionalModelOptions?: object;
    hideLogsFromAgent?: boolean;
}
interface AIMyAPIInstance {
    options: AIMyAPIOptions;
    generateCode: (queryText: string, userChatHistory: ChatCompletionMessageParam[]) => Promise<GenerateCodeResult | null>;
    runCode: (code: string) => Promise<CodeRunResult>;
    checkCode: (code: string) => Promise<CodeRunResult>;
    processRequest: (userQuery: string, context?: object) => Promise<GenerateCodeResult | null>;
}
interface GenerateCodeResult {
    success: boolean;
    code?: string;
    comments?: string;
}
declare function zodParseJSON<T>(schema: {
    parse: any;
}): (input: string) => T;
declare function createBasePrompt(apiFilePath: string, apiGlobalName: string, documentationPath?: string): string;
declare const generateCode: (instance: AIMyAPIInstance, queryText: string, userChatHistory: ChatCompletionMessageParam[], createTaskPrompt: string, debug?: boolean, hideLogsFromAgent?: boolean, model?: string, additionalModelOptions?: object, attempt?: number) => Promise<GenerateCodeResult | null>;
interface AIMyAPIModuleExports {
    createWithAPI: (options: AIMyAPIOptions) => Promise<AIMyAPIInstance>;
    createBasePrompt: (apiFilePath: string, documentationPath: string) => string;
    generateCode: (instance: AIMyAPIInstance, queryText: string, userChatHistory: ChatCompletionMessageParam[], createTaskPrompt: string, debug: boolean) => Promise<GenerateCodeResult | null>;
    createSandbox: (QuickJS: QuickJSWASMModule, globals: any) => Promise<any>;
}
declare const AIMyAPI: AIMyAPIModuleExports;

export { AIMyAPI, type AIMyAPIInstance, type AIMyAPIModuleExports, type AIMyAPIOptions, type CodeRunResult, type GenerateCodeResult, type GlobalOption, type Globals, type LogEntryType, type LogSource, Logger, type SandboxLogEntry, type SandboxLogOrError, type SandboxTrace, createBasePrompt, generateCode, zodParseJSON };
