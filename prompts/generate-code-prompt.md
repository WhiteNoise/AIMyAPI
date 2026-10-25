
Most recent user query: 
{{USER_QUERY}}

---

Based on the prior conversation, write a typescript script that performs the operation requested by the user and call the `submitCode` tool with the script. 

## API documentation

You can make use of this api:

`api.ts`:
```ts
{{API}}
```

## Instructions

Use the global object defined above to make calls to the API. The API runs in a development environment using mocked data.

The provided tools will execute code in a sandbox and you will only have access to the API provided above and the standard javascript api's. 

You may use top level `await` since your code will be wrapped in an async function before being run.
You should write safe code and catch exceptions. For errors, use `console.error` with a helpful message.
Avoid logging PII or sensitive information.

You may use `runCode` to experiment or test. Console logs will be returned with the tool results, including 'traces' which show calls to the API.

When finished, you must call `submitCode` to check and run the code. Examine the log traces that get returned to confirm that the expected calls were made and the code is running as expected. If not, you may call submit code again. Once finished, respond with "Successfully submitted code".

---

{{DOCUMENTATION}}

{{CONTEXT}}

