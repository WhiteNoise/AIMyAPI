import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { QuickJSWASMModule } from 'quickjs-emscripten';
import { ZodSchema } from 'zod';

interface GlobalOption {
    value: any;
    whitelist?: string[];
}
interface Globals {
    [key: string]: GlobalOption;
}
type SandboxLog = {
    type: "log" | "error";
    args: any[];
    source: string;
};
type CodeRunResult = {
    success: boolean;
    logs: SandboxLog[];
};

interface AIMyAPIOptions {
    apiObject: object;
    apiExports: object;
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
    code?: string;
    comments?: string;
}
declare function zodParseJSON<T>(schema: ZodSchema<T>): (input: string) => T;
declare function createBasePrompt(apiFilePath: string, apiGlobalName: string, documentationPath?: string): string;
declare const generateCode: (instance: AIMyAPIInstance, queryText: string, userChatHistory: ChatCompletionMessageParam[], createTaskPrompt: string, debug?: boolean, hideLogsFromAgent?: boolean, model?: string, additionalModelOptions?: object) => Promise<GenerateCodeResult | null>;
interface AIMyAPIModuleExports {
    createWithAPI: (options: AIMyAPIOptions) => Promise<AIMyAPIInstance>;
    createBasePrompt: (apiFilePath: string, documentationPath: string) => string;
    generateCode: (instance: AIMyAPIInstance, queryText: string, userChatHistory: ChatCompletionMessageParam[], createTaskPrompt: string, debug: boolean) => Promise<GenerateCodeResult | null>;
    createSandbox: (QuickJS: QuickJSWASMModule, globals: any) => Promise<any>;
}
declare const AIMyAPI: AIMyAPIModuleExports;

export { AIMyAPI, type AIMyAPIInstance, type AIMyAPIModuleExports, type AIMyAPIOptions, type CodeRunResult, type GenerateCodeResult, type GlobalOption, type Globals, type SandboxLog, createBasePrompt, generateCode, zodParseJSON };
