"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = __importDefault(require("../lib"));
const ordering_api_impl_1 = require("./ordering_api_impl");
const APIExports = __importStar(require("./ordering_api"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
function getInput(query) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}
// More complex fast food ordering example that uses chat history.
// Fast food ordering example.
// Interactive version
(async () => {
    const api = new ordering_api_impl_1.OrderingAPI();
    const aimyapi = await lib_1.default.createWithAPI({
        apiObject: api,
        apiGlobalName: "orderingApi",
        apiExports: APIExports,
        apiDefFilePath: path_1.default.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path_1.default.join(__dirname, "./ordering_api.md"),
        debug: false,
    });
    async function runQuery(query) {
        console.log(`Query: ${query}`);
        // generate the code for this query
        const code = await aimyapi.generateCode(query, api._getHistory());
        api._addMessageToHistory({
            content: query,
            role: "user",
            name: "user",
        });
        api._addMessageToHistory({
            content: '```\n' + code + '\n```',
            role: "assistant",
            name: "assistant",
        });
        // run the code in the sandbox
        await aimyapi.runCode(code);
    }
    console.log("Welcome to the restaurant. You can ask to hear the menu or order something. What would you like to do?");
    while (!api._isCompleted) {
        const query = await getInput("Your query: ");
        await runQuery(query);
    }
})();
