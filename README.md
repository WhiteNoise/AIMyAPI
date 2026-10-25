# AI My API

## Description

AIMyAPI is a typescript code sandbox and code writing harness for your LLM using [QuickJS](https://github.com/justjake/quickjs-emscripten). It allows you to expose a global API object and gives an agent tools to write functions against it without giving it access to the internet, your secrets or your filesystem except through the methods you define.  

It can be used to ask questions about your data, build small, self contained business functions like reports, calculations, workflow automations, plugins, and chat based AI ordering or support systems. Since it's based around writing code, it can invent new functionality in response to user requests with only basic CRUD access.

Note: Requires an OpenAI compatible API

## Features

- It simplifies the setup and usage of sandboxed typescript code
- It allows you to define what functions and data are available in the sandbox and write your own access rules
- It includes a small code writing harness to generate code against your API with typechecking and compilation checks (which helps the LLM catch mistakes and hallucinations) 
- It includes logging instrumentation to help the agent check code execution without having to guess
- It limits the problem space so that even small (2b) LLMs can produce correct code in a token efficient way by providing just enough context.

## Why use it?

- You want to allow an LLM to write code without giving it unfettered access to your file system and the internet, etc
- You want to perform operations on sensitive information or PII without needing to expose it to the LLM's context. Eg, the LLM defines the process, but does not actually do the work.

## Why not just give an agent tools or MCP access to your API's

You certainly could - the downside here would be less privacy and more token inefficiency. It may also be harder to put guardrails around what agents do and how they use the data they get, especially if combining multiple MCP's.

## About version 1.0 update and motivation

AIMyAPI was originally written at a time (circa ChatGPT 3.5 / GPT-4) before tool calling existed, before harnesses like Claude code and codex and just before OpenAI released their code interpreter. LLM models have also gotten drastically better since. Some of the problems I originally aimed to solve are better solved today with simple tool calling or MCP's. However, there is still a need to safely run small programs in a sandboxed way, reliable way. Tools are good if you have a set interface but there may be times that an agent needs to do some sorting or filtering, or an algorithm or analysis, or some repeatable workflow which isn't implemented by the available tool functions. Writing code allows the agent to do things it might not otherwise be able to do with tools alone. All the AI models are thoroughly trained to write code do solve all kinds of problems. Having the ability to write code allows the tools API surface to be smaller; it could simply be a set of CRUD operations and the agent can create whatever operations it needs from them.

The other advantage of writing code is privacy and security. When you run code in the sandbox, the agent doesn't need to see all the data or results. This means API keys or PII can be kept hidden and only the user sees them, depending on how you set things up. For most agents today, when an agent uses tools, it sees all the parameters and results of the tool calls so that means all your information is shared with your LLM provider.

Another advantage of writing code is that it can be audited for security and correctness before running it. Finally, code can encompass a series of operations, whereas tool calls need to be approved one at a time or just trusted, often without knowing what will come next.

Version 1.0 updates AIMyAPI code generation to use the tool calling process for writing code. This allows the agent to check the code and run some tests or API calls before committing to a final version. This should result in better code since the previous model relied on the agent always being able to one-shot the code, which depended on it having a complete view of the problem before writing the code which wasn't always realistic. We could also update this process a bit to add "Plan" / "Build" / "Test" phases instead of just one code generation prompt.

## What's new

AIMyAPI will handle async operations and timers in your API object. It will also now validate API function parameters against a Zod schema.

## Quickstart

Install the package

```bash
npm i aimyapi --save
```

**Setup:** create a .env file in the root of your project and add your OpenAI api key:
```bash
OPENAI_API_KEY=XXXX
OPENAI_API_BASE_URL=XXXX       // If using your own server, otherwise omit to use the default
OPENAI_API_MODEL=XXXX              // defaults to "gpt-5-mini"
```


Simply define your strongly-typed typescript API:

`sales_api.ts`
```typescript
// Sales data for each month, per business unit
export interface SalesData {
    sales: number;
    month: number;  // 1...12
    year: number;
    businessUnit: "Advertising" | "Hardware" | "Software";
}

export interface APIInterface {
    getSalesData(): SalesData[];
    // Returns an array of sales data.

    print(text: string): void;
    // Prints the specified text to the user.
};

// Global object you will use for accessing the APIInterface. Any other globals can go here too if you declare them in the `apiGlobals` parameter.
declare global {
    const api: APIInterface;
}

```

Implement it (`sales_api_impl.ts`):
```typescript
export class API implements APIInterface {

    getSalesData() {
    ...
```

Document it (`sales_api.md`):

```
Examples of how you should respond:

user: How are you today?

assistant:

api.print("I'm great, thanks for asking!");
```

Instantiate your api and AIMyAPI. AIMyAPI will wrap your API so that it can be called from within the QuickJS sandbox.

```typescript
import { AIMyAPI } from "aimyapi"

const api = new API();

const aimyapi = await AIMyAPI.createWithAPI({
    apiObject: api,
    apiExports: APIExports,
    apiDefFilePath: "./sales_api.ts",
    apiDocsPath: "./sales_api.md",
})
```

And now you can make requests against the API in natural language.
Any code generated by the LLM will be run within the sandbox. The LLM will ONLY have access to functions provided within your API and cannot use javascript to make http requests etc.

```typescript
await aimyapi.processRequest("Which business unit had the highest sales in 2020?");
```

This would produce the following code generated by the LLM prompt, which is run in the sandbox and makes calls on your API object:

```typescript

let salesData = api.getSalesData();
let maxSales = 0;
let businessUnitWithMaxSales = "";
for (let i = 0; i < salesData.length; i++) {
    if (salesData[i].year === 2020 && salesData[i].sales > maxSales) {
        maxSales = salesData[i].sales;
        businessUnitWithMaxSales = salesData[i].businessUnit;
    }
}
api.display(\`The business unit with the highest sales in 2020 was ${businessUnitWithMaxSales}.\`);

```

This example does not take advantage of the chat history and treats every request as a fresh chat. See `example2` for a more complex example that uses the chat history.

APIs should be kept simple and understandable. If you have a complicated API you may want to write a simpler facade for it.

### Limitations

The sandbox implementation supports basic types and the built in objects Promise and Date. It doesn't currently support Map, Set, Regex, etc. So you cannot return those types from your API functions. Some Date functionality differs from current javascript specs.

### Recommendations

Create a separate sandbox with a mocked API for generating code. This way the agent doesn't modify anything while troubleshooting or running test scripts. Additionally it prevents the agent from ever seeing real data if you want to maintain privacy. Use the real API only when you want to run code.

Implement schema validation for your API functions. Follow the convention by defining `_params_[FUNCTIONNAME]` as a Zod object:

```ts
// Schema validation for function parameters. Will throw if parameters are invalid to prevent silent failures and surface info to the agent.
// fields should be defined in the same order that they occur in the function
public _params_sendEmail = z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string().min(5)
})

// Mock implementation, doesn't actually send an email
async sendEmail(to: string, subject: string, body: string): Promise<void> {
    ...
}
```


## API Reference for AIMyAPI

### createWithAPI(options: AIMyAPIOptions): Promise<CreateWithAPIExports>

Primary function you will use to create a module for working your API API. For a simple example with no chat history, see example1. For an example with chat history see example2.

#### Options:

```typescript
export interface AIMyAPIOptions {
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
};
```

- `apiObject`: An object representing the API to be used.
- `apiExports`: An object representing the exported functions and variables from the API.
- `apiGlobals` (optional): An object representing global variables for the API.
- `apiDefFilePath`: A string representing the full path to the API definition file.
- `apiGlobalName` (optional): A string representing the name of the global variable for the API.
- `apiDocsPath` (optional): A string representing the path to the documentation for the API.
- `debug` (optional): A boolean indicating whether to output debugging information.

### The AIMyAPI module (type: CreateWithAPIExports)

The module created by the `createWithAPI` function:

#### Methods

```typescript
export interface AIMyAPIInstance {
    options:AIMyAPIOptions;
    generateCode: (queryText:string, userChatHistory:ChatCompletionMessageParam[]) => Promise<GenerateCodeResult | null>;
    runCode: (code:string) => Promise<CodeRunResult>;
    checkCode: (code:string) => Promise<CodeRunResult>;
    // run a single request with no history
    processRequest: (userQuery:string, context?: object) => Promise<GenerateCodeResult | null>;
}
```

- `generateCode()`: A function that generates code to be run in the sandbox for the given query text and user chat history.
- `runCode()`: A function that runs the generated code in the sandbox.
- `checkCode()`: Typecheck / compile the code
- `processRequest()`: A single function that generates and runs code assuming no chat history. This is more of a convenience function for the examples, since code gen and runn


## Safety notes:

- When generating code, you should use a mocked version of your API. You can create separate sandboxes for writing code vs. running code.
- If the user is giving sensitive information in a query, that information isn't private. Refer to the OpenAI policies and plan accordingly.
- The LLM will do stupid things with your API. You should idiot proof your functions, make sure you sanity check any inputs, etc.
- Even though we are running the code in sandbox, you should still treat anything coming back from the LLM as untrusted code.
- You should never give the LLM access to anything mission critical through your API such as live production data or services. 
- Give as few permissions as is necessary - read only access would be preferred. 
- Users can trick the LLM to do things that you may not want or intend. Again, access controls are critical. You shouldn't let users access anything they wouldn't normally be able to access via your API.
- Any 'dangerous' operations should involve some kind of human oversight and approval.
- A way to audit and rollback anything the LLM does would be wise. The LLM can misunderstand requests due to false assumptions or incomplete information (or trickery). If you allow it to modify your data it could mess things up.
- By using this library you acknowledge that you take full responsibility for anything that happens as a result of it's use. We cannot gaurantee what will happen based on your instructions to the LLM or how the LLM interprets them etc.




