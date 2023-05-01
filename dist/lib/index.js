"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCode = exports.createBasePrompt = void 0;
require('dotenv').config();
const openai_1 = require("openai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sandbox_1 = __importDefault(require("./sandbox"));
const sandbox_wrappers_1 = require("./sandbox-wrappers");
const quickjs_emscripten_1 = require("quickjs-emscripten");
const configuration = new openai_1.Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new openai_1.OpenAIApi(configuration);
// function formatObject(obj: any): string {
//     return Object.keys(obj).reduce((acc, key) => {
//       return `${acc}${key}:\n${obj[key]}\n\n`;
//     }, "");
// }
function createBasePrompt(apiFilePath, documentationPath) {
    const apiText = fs_1.default.readFileSync(apiFilePath, 'utf8');
    const documentationText = documentationPath ? fs_1.default.readFileSync(documentationPath, 'utf8') : '';
    //console.time("Loading templates");
    const createTaskPrompt = fs_1.default.readFileSync(path_1.default.join(__dirname, '../prompts/create-task-prompt.md'), 'utf8').replace("{{DOCUMENTATION}}", documentationText).replace("{{API}}", apiText);
    //console.timeEnd("Loading templates")
    return createTaskPrompt;
}
exports.createBasePrompt = createBasePrompt;
// userChatHistory is not currently used but could be in the future.
const generateCode = async function (queryText, userChatHistory, createTaskPrompt, apiPath, debug = false) {
    if (!queryText)
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
        });
        if (debug)
            console.log(results.data.usage);
        const response = results.data.choices[0].message.content;
        if (debug)
            console.log(response);
        // Return only the code between ``` and ``` (usually at the end of the completion)
        const codeStart = response.indexOf('```');
        const codeEnd = response.lastIndexOf('```');
        if (codeStart === -1 || codeEnd === -1 || codeStart === codeEnd)
            return '';
        generatedCode = response.substring(codeStart + 3, codeEnd).replace('typescript', '');
        generatedCode = `// Query=${queryText}\n` + generatedCode.replace("./api.ts", apiPath);
        return generatedCode;
    }
    catch (err) {
        console.error(err);
        return '';
    }
};
exports.generateCode = generateCode;
let QuickJS = null;
;
async function createWithAPI(options) {
    // extend options with defaults
    options = {
        apiGlobalName: "api",
        apiGlobals: {},
        debug: false,
        ...options
    };
    if (!options.apiObject || !options.apiDefFilePath) {
        throw new Error("apiObject and apiFilePath are required");
    }
    const { apiObject, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug } = options;
    const whitelist = Object.getOwnPropertyNames(Object.getPrototypeOf(apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_"));
    const createTaskPrompt = createBasePrompt(apiDefFilePath, apiDocsPath);
    return {
        generateCode: async function (queryText, userChatHistory, currentContext = undefined) {
            if (!queryText)
                return '';
            return await (0, exports.generateCode)(queryText, userChatHistory, createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```" + JSON.stringify(currentContext, null, 2) + "```" : ""), apiDefFilePath, debug);
        },
        runCode: async function (generatedCode) {
            if (!QuickJS) {
                // Create QuickJS
                if (debug)
                    console.log("Creating quick.js");
                QuickJS = await (0, quickjs_emscripten_1.getQuickJS)();
            }
            let apiGlobals = {};
            for (const key in options.apiGlobals) {
                apiGlobals[key] = {
                    value: options.apiGlobals[key],
                };
            }
            // Create sandbox           
            // NOTE: not sure why I have to replace the backslash here
            const { vm, runTask, isAsyncProcessRunning } = await (0, sandbox_1.default)(QuickJS, {
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
                if (!res) {
                    console.error("Task unsuccessful");
                }
                while (isAsyncProcessRunning()) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                if (debug) {
                    console.log("Completed");
                }
            }
            catch (err) {
                if (debug) {
                    console.error("Error running task:", err);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            (0, sandbox_wrappers_1.rejectOpenPromises)(vm);
            vm.dispose();
        },
        processRequest: async function (userQuery, currentContext = undefined) {
            // Create prompt
            if (debug) {
                console.log("Query:", userQuery);
            }
            // Generate Code
            console.time("Generate Task");
            const generatedCode = await (0, exports.generateCode)(userQuery, [], createTaskPrompt.replace("{{CONTEXT}}", currentContext ? "```" + JSON.stringify(currentContext, null, 2) + "```" : ""), apiDefFilePath);
            console.timeEnd("Generate Task");
            if (debug) {
                console.log("Generated Code:", generatedCode);
            }
            console.time("Run Code");
            await this.runCode(generatedCode);
            console.timeEnd("Run Code");
            return generatedCode;
        }
    };
}
const aimyapi = {
    // Standard way of using the library
    createWithAPI,
    // functions for customized usage
    createBasePrompt,
    generateTask: exports.generateCode,
    createSandbox: sandbox_1.default,
};
exports.default = aimyapi;
