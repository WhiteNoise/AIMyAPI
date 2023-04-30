require('dotenv').config()
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import fs from 'fs';
import path from 'path';

import createSandbox from "../lib/sandbox";
import { rejectOpenPromises } from '../lib/sandbox-wrappers';



import { QuickJSWASMModule, getQuickJS } from "quickjs-emscripten";

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

const openai = new OpenAIApi(configuration);

// function formatObject(obj: any): string {
//     return Object.keys(obj).reduce((acc, key) => {
//       return `${acc}${key}:\n${obj[key]}\n\n`;
//     }, "");
// }

export function createBasePrompt(apiFilePath:string, documentationPath: string): string {
    const apiText: string = fs.readFileSync(apiFilePath, 'utf8');
    const documentationText: string = documentationPath ? fs.readFileSync(documentationPath, 'utf8') : '';

    //console.time("Loading templates");
    
    const createTaskPrompt: string = fs.readFileSync( path.join(__dirname, '../prompts/create-task-prompt.md'), 'utf8').replace("{{DOCUMENTATION}}", documentationText).replace("{{API}}", apiText);
    
    //console.timeEnd("Loading templates")
    
    return createTaskPrompt;
}

// userChatHistory is not currently used but could be in the future.
export const generateCode = async function(queryText:string, userChatHistory:ChatCompletionRequestMessage[], createTaskPrompt:string, apiPath:string, debug:boolean = false): Promise<string> {
    if(!queryText)
        return;

    let generatedCode = '';
    const prompt = createTaskPrompt.replace("{{QUERY_TEXT}}", queryText);

    // TODO: I should switch this back to gpt3.5 turbo since it's cheaper
    try {
        // const task = await openai.createCompletion(
        //     {
        //     model: "text-davinci-003",
        //     prompt,
        //     temperature: 0.1,
        //     max_tokens: 1100,
        //     }
        // );

        const results = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
                ...userChatHistory,
                {
                    role: "user",
                    content: `${queryText}`,
                    name: "user"
                }
            ],
            temperature: 0.1,
            max_tokens: 800,
            }
        );


        if(debug)
            console.log(results.data.usage);
        
        const response = results.data.choices[0].message.content;

        if(debug)
            console.log(response);
            
        // Return only the code between ``` and ``` (usually at the end of the completion)
        const codeStart = response.indexOf('```');
        const codeEnd = response.lastIndexOf('```');

        if(codeStart === -1 || codeEnd === -1 || codeStart === codeEnd)
            return '';

        generatedCode = response.substring(codeStart + 3, codeEnd).replace('typescript', '');
       
        generatedCode = `// Query=${queryText}\n` + generatedCode.replace("./api.ts", apiPath);
        return generatedCode;
    } catch(err) {
        console.error(err);
        return '';
    } 

};

let QuickJS:QuickJSWASMModule = null;

export interface AIMyAPIOptions {
    apiObject: object;
    apiExports: object;
    apiGlobals?: object;
    apiDefFilePath: string;     // Full path to the api definition file so that it can be loaded into the prompt
    apiGlobalName?: string;    
    apiDocsPath?: string;
    debug?: boolean;
};

export interface CreateWithAPIExports {
    // see xample 2
    generateCode: (queryText:string, userChatHistory:ChatCompletionRequestMessage[]) => Promise<string>;
    runCode: (task:string) => Promise<void>;
    // run a single request with no history
    processRequest: (userQuery:string, context?: object) => Promise<string>;
    
}

async function createWithAPI(options:AIMyAPIOptions): Promise<CreateWithAPIExports> {
    // extend options with defaults
    options = {
        apiGlobalName: "api",
        apiGlobals: {},
        debug: false,
        ...options
    };

    if(!options.apiObject || !options.apiDefFilePath) {
        throw new Error("apiObject and apiFilePath are required");
    }

    const {apiObject, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug} = options;

    const whitelist =  Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_"));
    const createTaskPrompt = createBasePrompt( apiDefFilePath, apiDocsPath);

    return {
        generateCode: async function(queryText:string, userChatHistory:ChatCompletionRequestMessage[], currentContext:any = undefined) {
            if(!queryText)
                return '';

            return await generateCode(queryText, userChatHistory, createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```" + JSON.stringify(currentContext, null, 2) + "```" : ""), apiDefFilePath, debug);
        },
        runCode: async function(generatedCode:string) {
            if(!QuickJS) {
                // Create QuickJS
                if(debug)
                    console.log("Creating quick.js");
                QuickJS = await getQuickJS();
            }

            let apiGlobals = {}

            for(const key in options.apiGlobals) {
                apiGlobals[key] = {
                    value: options.apiGlobals[key],
                }
            }
      
            // Create sandbox           
            // NOTE: not sure why I have to replace the backslash here
            const {vm, runTask, isAsyncProcessRunning} = await createSandbox(QuickJS, {
                [apiDefFilePath.replaceAll("\\", "")]: apiExports,
            }, { 
                ...apiGlobals,
                [apiGlobalName]: {
                    value: apiObject,
                    whitelist
                }
            }, options.debug);

            try {
                const res = await runTask(generatedCode);
        
                if(!res) {
                    console.error("Task unsuccessful");
                } 
        
                while(isAsyncProcessRunning()) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            
                if(debug) {
                    console.log("Completed");
                }
            } catch(err) {
                if(debug) {
                    console.error("Error running task:", err);
                }
            }
        
            await new Promise((resolve) => setTimeout(resolve, 100));
        
            rejectOpenPromises(vm);
            vm.dispose()             
        
        }, 
        processRequest: async function (userQuery, currentContext:any = undefined):Promise<string> {
            // Create prompt
            
            if(debug) {
                console.log("Query:", userQuery);
            }
        
            // Generate Code
            console.time("Generate Task")
            const generatedCode = await generateCode(userQuery, [], createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```" + JSON.stringify(currentContext, null, 2) + "```" : "" ), apiDefFilePath);
            console.timeEnd("Generate Task")
        
            if(debug) {
                console.log("Generated Code:", generatedCode);
            }

            console.time("Run Code")
            await this.runCode(generatedCode);
            console.timeEnd("Run Code")

            return generatedCode;
        }
    }

}

export interface AIMyAPIExports {
    createWithAPI: (options:AIMyAPIOptions) => Promise<CreateWithAPIExports>;
    
    createBasePrompt: (apiFilePath:string, documentationPath: string) => string;
    generateTask: (queryText:string, userChatHistory:any[], createTaskPrompt:string, apiPath:string) => Promise<string>;
    createSandbox: (QuickJS:QuickJSWASMModule, globals: any) => Promise<any>;
}

const aimyapi:AIMyAPIExports = {
    // Standard way of using the library
    createWithAPI,      

    // functions for customized usage
    createBasePrompt,   
    generateTask: generateCode,
    createSandbox,
}

 export default aimyapi;