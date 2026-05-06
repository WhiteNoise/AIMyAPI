require('dotenv').config()
import fs from 'fs';
import { OpenAI } from "openai";

import createSandbox, { CodeRunResult } from "./sandbox";
import { rejectOpenPromises } from './sandbox-wrappers';

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { QuickJSWASMModule, getQuickJS } from "quickjs-emscripten";

import { AutoParseableTool } from 'openai/lib/parser.js';
import { ZodSchema, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const openai = new OpenAI( { baseURL: process.env.OPENAI_API_BASE_URL || undefined, apiKey: process.env.OPENAI_API_KEY || undefined } );

let QuickJS:QuickJSWASMModule | null = null;

export interface AIMyAPIOptions {
    apiObject: object;
    apiExports?: object;
    apiWhitelist?: string[];      // List of functions to expose to the user. Necessary to pass this yourself if you are extending your api from another class.
    apiGlobals?: object;
    apiDefFilePath: string;     // Full path to the api definition file so that it can be loaded into the prompt
    apiGlobalName?: string;    
    apiDocsPath?: string;
    debug?: boolean;
    model?: string;
    additionalModelOptions?: object;
    hideLogsFromAgent?: boolean; // If true, logs from code execution will not be included in the messages sent to the agent. This can be useful to prevent the agent from being overwhelmed with logs or to hide implementation details. Default is false (logs will be included in messages).
};

export interface AIMyAPIInstance {
    options:AIMyAPIOptions;
    generateCode: (queryText:string, userChatHistory:ChatCompletionMessageParam[]) => Promise<GenerateCodeResult | null>;
    runCode: (code:string) => Promise<CodeRunResult>;
    checkCode: (code:string) => Promise<CodeRunResult>;
    // run a single request with no history
    processRequest: (userQuery:string, context?: object) => Promise<GenerateCodeResult | null>;
}

export interface GenerateCodeResult {
    code?: string;
    comments?: string;
}


const wrapCode = (apiGlobalName:string, apiFileDefPath:string, code:string) => `
(async () => {
    try {
        ${code}
    } catch(err) { 
        console.error(err); 
    }
})();        
`;

const wrapCodeBlock = (code:string, codeType:string = "") => `
\`\`\`${codeType}
${code}
\`\`\`
`;

export function zodParseJSON<T>(schema: ZodSchema<T>) {
  return (input: string): T => schema.parse(JSON.parse(input));
}

export function createBasePrompt(apiFilePath:string, apiGlobalName: string, documentationPath?: string, ): string {
    const apiText: string = fs.readFileSync(apiFilePath, 'utf8');
    const documentationText: string = documentationPath ? fs.readFileSync(documentationPath, 'utf8') : '';

    //console.time("Loading templates");
    const createTaskPrompt: string = fs.readFileSync( './prompts/create-task-prompt.md', 'utf8').replace("{{DOCUMENTATION}}", documentationText).replace("{{API}}", apiText).replace("{{API_GLOBAL_NAME}}", apiGlobalName || "");   
    //console.timeEnd("Loading templates")
    
    return createTaskPrompt;
}


const runCodeSchema = z.object({
    code: z.string(),
});

const checkCodeSchema = z.object({
    code: z.string(),
});

const submitCodeSchema = z.object({
    code: z.string(),
});

export const generateCode = async function(instance:AIMyAPIInstance, queryText:string, userChatHistory:ChatCompletionMessageParam[], createTaskPrompt:string, debug:boolean = false, hideLogsFromAgent:boolean = false, model="gpt-5-mini", additionalModelOptions?: object): Promise<GenerateCodeResult | null> {
    let finalSubmittedCode = "";

    if(debug) {
        console.log("Generating code for query:", queryText);
    }
    // checkcode
    const codingTools: AutoParseableTool<any, true>[] = [
        {
            type: "function",
            function: {
                name: "runCode",
                // @ts-ignore
                function: async ({code}: {code: string}) => {   
                    if(debug) {
                        console.log("Running code...", code);                 
                    }
                    
                    const res = await instance.runCode(code);

                    if(hideLogsFromAgent) {
                        res.logs = [];
                    }
                    return res;
                },
                description: "Run the provided code in a sandboxed environment. The code will have access to the API object. Returns the result of the code execution.",
                parse: zodParseJSON(runCodeSchema),
                parameters: zodToJsonSchema(runCodeSchema),            
            }
        },
        {
            type: "function",
            function: {
                name: "checkCode",
                // @ts-ignore
                function: async ({code}: {code: string}) => {   
                    if(debug) {
                        console.log("Checking code...", code);                 
                    }
                    const res = await instance.checkCode(code);
                    
                    return res;

                },
                description: "Check the provided code for errors or issues without running it. Returns the result of the code check.",
                parse: zodParseJSON(checkCodeSchema),
                parameters: zodToJsonSchema(checkCodeSchema),
            }
        },        
        {
            type: "function",
            function: {
                name: "submitCode",
                // @ts-ignore
                function: async ({code}: {code: string}) => {   
                    finalSubmittedCode = code;
                    return {
                        success: true,
                    }
                },
                description: "Submit the provided code as the final code to run. This will end the code generation process and the code will be run in the sandbox. Use this when you are confident in the code you have generated and want to run it.",
                parse: zodParseJSON(submitCodeSchema),
                parameters: zodToJsonSchema(submitCodeSchema),
            }
        }
    ];

    try {
        
        const runner = openai.chat.completions
        .runTools({
          model,
          messages: [
            {
              role: 'system',
              content: "You will assist with writing code to perform the user's request.",
            },
            ...userChatHistory,
            {
                role: 'user',
                content: createTaskPrompt.replace("{{USER_QUERY}}", queryText)
            },

          ],
          tools: codingTools,
          ...additionalModelOptions,

        })
        .on('message', async (message: ChatCompletionMessageParam) => {
            if(debug) {
                console.log("Message:", JSON.stringify(message, null, 2));

            }
        })
        .on('functionToolCall', (functionCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall.Function) => {
            if(debug) {
                console.log("Function Call:", JSON.stringify(functionCall, null, 2));
            }
            

        })
        .on('functionToolCallResult', (functionCall) => {
            if(debug) {
                console.log("Function Call Result:", JSON.stringify(functionCall, null, 2));
            }
        })
    
      const finalContent = await runner.finalContent();

      if(debug) {
        console.log("Final Content:", finalContent);
      }
      
      return {
        code: finalSubmittedCode,
        comments: finalContent || undefined,
      }

    } catch(err) {
        console.error(err);
        return null;
    }
};

async function createWithAPI(options:AIMyAPIOptions): Promise<AIMyAPIInstance> {
    // extend options with defaults
    const localOptions = {
        ...{
            apiGlobalName: "api",
            apiGlobals: {},
            apiWhitelist: Object.getOwnPropertyNames(Object.getPrototypeOf(options.apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_")),
            debug: false, 
            model: process.env.OPENAI_API_MODEL || "gpt-5.4-mini",
            additionalModelOptions: {},
            hideLogsFromAgent: false,
        },
        ...options
    };

    if(!localOptions.apiObject || !localOptions.apiDefFilePath) {
        throw new Error("apiObject and apiDefFilePath are required");
    }

    const {apiObject, apiWhitelist, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug, model, additionalModelOptions, hideLogsFromAgent} = localOptions;

    const createTaskPrompt = createBasePrompt( apiDefFilePath, apiGlobalName, apiDocsPath);

    const instance = {
        options: localOptions,
        generateCode: async function(queryText:string, userChatHistory:ChatCompletionMessageParam[], currentContext:any = undefined) {            
            if(!queryText)
                return null;

            const formattedContext = wrapCodeBlock(JSON.stringify(currentContext, null, 2), "json");

            return await generateCode(instance, 
                queryText, 
                userChatHistory, 
                createTaskPrompt.replace("{{CONTEXT}}", formattedContext), 
                debug, 
                hideLogsFromAgent, 
                model, 
                additionalModelOptions
            );
        },
        checkCode: async function (generatedCode:string): Promise<CodeRunResult> {
            if(!QuickJS) {
                // Create QuickJS
                if(debug)
                    console.log("Creating quick.js");
                QuickJS = await getQuickJS();
            }

            let apiGlobals: { [key: string]: { value: any } } = {}

            if(options.apiGlobals) {
                for(const key in options.apiGlobals) {
                    apiGlobals[key] = {
                        value: (options.apiGlobals as Record<string, any>)[key],
                    }
                }
            }
        
            // Create sandbox           
            const {vm, checkCode} = await createSandbox(QuickJS, apiExports ? {
                [apiDefFilePath]: apiExports,
            } : undefined, { 
                ...apiGlobals,
                [apiGlobalName]: {
                    value: apiObject,
                    whitelist: apiWhitelist
                }
            }, options.debug);

            try {
                if(debug) {
                    console.log("checking Code:\n", generatedCode);
                }

                const res = await checkCode(wrapCode(apiGlobalName, apiDefFilePath, generatedCode));
        
                if(!res) {
                    console.error("Unknown failure checking code");
                    return {
                        success: false,
                        logs: [],
                    };
                } 
        
            
                if(debug) {
                    console.log(res.success ? "Code check passed" : "Code check failed");
                }

                if(res.success) {
                    return {
                        success: true,
                        logs: [{ type: "log", args: ["✔️ Code check passed"], source: "compiler" }, ...res.logs],
                    }
                }

                return {
                    success: false,
                    logs: [{ type: "error", args: ["❌ Code check failed"], source: "compiler" }, ...res.logs],
                };
            } catch(err) {
                if(debug) {
                    console.error("Error checking code:", err);
                }
            }
            vm.dispose();

            return {
                success: false,
                logs: [],
            };
        },    
        runCode: async function (code:string): Promise<CodeRunResult> {
            // TODO: fix code duplication with checkCode, maybe combine into a single function that takes a parameter for whether to actually run the code or just check it?
            if(!QuickJS) {
                // Create QuickJS
                if(debug)
                    console.log("Creating quick.js");
                QuickJS = await getQuickJS();
            }

            let apiGlobals: { [key: string]: { value: any } } = {}

            if(options.apiGlobals) {
                for(const key in options.apiGlobals) {
                    apiGlobals[key] = {
                        value: (options.apiGlobals as Record<string, any>)[key],
                    }
                }
            }
        
            // Create sandbox           
            // NOTE: not sure why I have to replace the backslash here
            const {vm, runCode: runTask, isAsyncProcessRunning} = await createSandbox(QuickJS, apiExports ? {
                [apiDefFilePath]: apiExports,
            } : undefined, { 
                ...apiGlobals,
                [apiGlobalName]: {
                    value: apiObject,
                    whitelist: apiWhitelist
                }
            }, options.debug);

            try {
                if(debug) {
                    console.log("Running Code:\n", code);
                }

                const res = await runTask(wrapCode(apiGlobalName, apiDefFilePath, code));
        
                if(!res) {
                    console.error("Unknown failure running task");
                    return {
                        success: false,
                        logs: [],
                    };
                } 
        
                while(isAsyncProcessRunning()) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            
                if(debug) {
                    console.log("Completed");
                }

                return res;
            } catch(err) {
                if(debug) {
                    console.error("Error running task:", err);
                }
            }
        
            await new Promise((resolve) => setTimeout(resolve, 100));
        
            rejectOpenPromises(vm);
            vm.dispose();

            return {
                success: false,
                logs: [],
            };
        }, 
        // generates code and runs it in one step
        processRequest: async function (userQuery: string, currentContext:any = undefined):Promise<GenerateCodeResult | null> {
            // Create prompt
            
            if(debug) {
                console.log("Query:", userQuery);
            }
        
            // Generate Code
            console.time("Generate Task")
            const generatedCode:GenerateCodeResult | null = await generateCode(instance, 
                userQuery, 
                [], 
                createTaskPrompt.replace("{{CONTEXT}}", currentContext ? JSON.stringify(currentContext, null, 2) : "" ), 
                debug, 
                hideLogsFromAgent, 
                model, 
                additionalModelOptions
            );
            console.timeEnd("Generate Task")
        
            console.time("Run Code")
            if(generatedCode?.code) {
                await instance.runCode(generatedCode.code);
            } else {
                console.error("No code generated", generatedCode);
            }
            console.timeEnd("Run Code")

            return generatedCode;
        }
    }

    return instance;

}

export interface AIMyAPIModuleExports {
    createWithAPI: (options:AIMyAPIOptions) => Promise<AIMyAPIInstance>;
    
    createBasePrompt: (apiFilePath:string, documentationPath: string) => string;
    generateCode: (instance: AIMyAPIInstance, queryText:string, userChatHistory:ChatCompletionMessageParam[], createTaskPrompt:string, debug:boolean) => Promise<GenerateCodeResult | null>;
    createSandbox: (QuickJS:QuickJSWASMModule, globals: any) => Promise<any>;
}

export const AIMyAPI:AIMyAPIModuleExports = {
    // Standard way of using the library
    createWithAPI,      

    // functions for customized usage
    createBasePrompt,   
    generateCode,
    createSandbox,
}

export * from "./sandbox";

