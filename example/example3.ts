
import AIMyAPI from "../lib";
import { OrderingAPI } from "./ordering_api_impl";
import * as APIExports from "./ordering_api";
import path from "path";

import readline from 'readline';

function getInput(query): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

// More complex fast food ordering example that uses chat history.
// Fast food ordering example.
// Interactive version
(async () => {
    const api = new OrderingAPI();

    const aimyapi = await AIMyAPI.createWithAPI({
        apiObject: api,
        apiGlobalName: "orderingApi",       // Should match whatever you declared as your global in your ordering api.
        apiExports: APIExports,
        apiDefFilePath: path.join(__dirname, "./ordering_api.ts"),
        apiDocsPath: path.join(__dirname, "./ordering_api.md"),
        debug: false,
    })

    async function runQuery(query:string) {
        console.log(`Query: ${query}`)

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
        const query:string = await getInput("Your query: ");
        await runQuery(query);
    }

})();