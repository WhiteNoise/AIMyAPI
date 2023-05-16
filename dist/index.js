"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCode = exports.createBasePrompt = void 0;
require('dotenv').config();
const fs_1 = __importDefault(require("fs"));
const openai_1 = require("openai");
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
// FIXME: add an options parameter and allow specifying the token limit
const generateCode = async function (queryText, userChatHistory, createTaskPrompt, apiPath, debug = false) {
    if (!queryText)
        return { code: '', loggableCode: '' };
    let generatedCode = '';
    const prompt = createTaskPrompt.replace("{{QUERY_TEXT}}", queryText);
    const messages = [
        {
            role: "system",
            content: prompt,
        },
        ...userChatHistory,
        {
            role: "user",
            content: `${queryText}.\nRespond only with code enclosed in \`\`\`.`,
            name: "user"
        }
    ];
    try {
        const results = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.1,
            max_tokens: 700,
        });
        if (debug)
            console.log(results.data.usage);
        const response = results.data.choices[0].message.content;
        if (debug)
            console.log(response);
        // Return only the code between ``` and ``` (usually at the end of the completion)
        const codeStart = response.indexOf('```');
        const codeEnd = response.lastIndexOf('```');
        // error, no code detected inside the response
        if (codeStart === -1 || codeEnd === -1 || codeStart === codeEnd) {
            return { code: '', loggableCode: '', rawResponse: response };
        }
        generatedCode = response.substring(codeStart + 3, codeEnd).replace('typescript', '');
        const codeHeader = `import * as ApiDefs from '${apiPath}'\n(async() {\n\ttry {`;
        const codeFooter = `\n\t} catch(err) {\n\t\tconsole.error(err);\n\t}\n})();`;
        return { code: codeHeader + generatedCode + codeFooter, loggableCode: generatedCode };
    }
    catch (err) {
        console.error(err);
        return { code: '', loggableCode: '' };
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
        apiWhitelist: Object.getOwnPropertyNames(Object.getPrototypeOf(options.apiObject)).filter((f) => f !== "constructor" && !f.startsWith("_")),
        debug: false,
        ...options
    };
    if (!options.apiObject || !options.apiDefFilePath) {
        throw new Error("apiObject and apiFilePath are required");
    }
    const { apiObject, apiWhitelist, apiGlobalName, apiExports, apiDefFilePath, apiDocsPath, debug } = options;
    const createTaskPrompt = createBasePrompt(apiDefFilePath, apiDocsPath);
    return {
        options,
        generateCode: async function (queryText, userChatHistory, currentContext = undefined) {
            if (!queryText)
                return { code: '', loggableCode: '' };
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
                    whitelist: apiWhitelist
                }
            }, options.debug);
            try {
                if (debug) {
                    console.log("Running Code:\n", generatedCode);
                }
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
            console.time("Run Code");
            await this.runCode(generatedCode.code);
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
    generateCode: exports.generateCode,
    createSandbox: sandbox_1.default,
};
exports.default = aimyapi;
