import { ChatCompletionRequestMessage } from "openai";
import { QuickJSWASMModule } from "quickjs-emscripten";
export declare function createBasePrompt(apiFilePath: string, documentationPath: string): string;
export declare const generateCode: (queryText: string, userChatHistory: ChatCompletionRequestMessage[], createTaskPrompt: string, apiPath: string, debug?: boolean) => Promise<string>;
export interface AIMyAPIOptions {
    apiObject: object;
    apiExports: object;
    apiWhitelist?: string[];
    apiGlobals?: object;
    apiDefFilePath: string;
    apiGlobalName?: string;
    apiDocsPath?: string;
    debug?: boolean;
}
export interface AIMyAPIInstance {
    options: AIMyAPIOptions;
    generateCode: (queryText: string, userChatHistory: ChatCompletionRequestMessage[]) => Promise<string>;
    runCode: (task: string) => Promise<void>;
    processRequest: (userQuery: string, context?: object) => Promise<string>;
}
export interface AIMyAPIModuleExports {
    createWithAPI: (options: AIMyAPIOptions) => Promise<AIMyAPIInstance>;
    createBasePrompt: (apiFilePath: string, documentationPath: string) => string;
    generateCode: (queryText: string, userChatHistory: ChatCompletionRequestMessage[], createTaskPrompt: string, apiPath: string, debug: boolean) => Promise<string>;
    createSandbox: (QuickJS: QuickJSWASMModule, globals: any) => Promise<any>;
}
declare const aimyapi: AIMyAPIModuleExports;
export default aimyapi;
