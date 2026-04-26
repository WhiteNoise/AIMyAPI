
Most recent user query: 
```
{{USER_QUERY}}
```

Based on the above conversation, write a typescript script that performs the next operation requested by the user. 

Here's the typescript API to use for your script.

`api.ts`:
```typescript
{{API}}
```

Use the global api object to make calls to the API.
You may use top level `await`. 

If needed, gather any information you need to complete the request. 
You may use `runCode` to run any non-destructive API calls to understand what you need to do. Nothing will be returned unless you `console.log` it.
In your code, `console.log` and `console.error` can be used to understand the execution or indicate that an error happened, but debug logs should be removed in the final version.
You can use the `checkCode` tool to confirm that the code passes the typescript compilation and doesn't have errors
You can call `submitCode` to submit the final version of the code.

---

{{DOCUMENTATION}}

{{CONTEXT}}

