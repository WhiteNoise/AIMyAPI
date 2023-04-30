require('dotenv').config()
import { Configuration, OpenAIApi } from "openai";
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
export const generateTask = async function(queryText:string, userChatHistory:any[], createTaskPrompt:string, apiPath:string): Promise<string> {
    if(!queryText)
        return;

    let generatedCode = '';
    const prompt = createTaskPrompt.replace("{{QUERY_TEXT}}", queryText);

    // TODO: I should switch this back to gpt3.5 turbo since it's cheaper
    try {
        const task = await openai.createCompletion(
            {
            model: "text-davinci-003",
            prompt,
            temperature: 0.1,
            max_tokens: 1100,
            }
        );

        // uncomment to see token usage
        //console.log(task.data.usage);

        // strip ``` markdown (usually at the end of the completion)
        generatedCode = task.data.choices[0].text.replace(/```.*/g, '')

        // wrap the generated code with the necessary imports and async wrapper since it's running in the top level.
        // Note: The imports are mostly only interfaces and should be removed when typescript compiles it.
        // Anything else should have been created as a global in the sandbox.ts
        const taskHeader = `// Query=${queryText}\nimport * as ApiDefs from "${apiPath}";\n\n(async() {\n    try {`;

        return taskHeader + generatedCode;
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
    processRequest: (userQuery:string, context?: object) => Promise<string>;
    runCode: (task:string) => Promise<void>;
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
            const generatedCode = await generateTask(userQuery, [], createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```" + JSON.stringify(currentContext, null, 2) + "```" : "" ), apiDefFilePath);
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
    generateTask,
    createSandbox,
}

 export default aimyapi;