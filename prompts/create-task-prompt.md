
Most recent user query: 
{{USER_QUERY}}

---

Based on the prior conversation, write a typescript script that performs the operation requested by the user and call the `submitCode` tool with the script. 

## API documentation

You can make use of this global API object:

`api.ts`:
```typescript
{{API}}
```

## Instructions

Use the global api object to make calls to the API.

You may use top level `await`. 

If needed, you may use `runCode` to run any non-destructive API calls to gather data for your script. Nothing will be visible to you unless you `console.log` it.

You may use the `checkCode` tool to confirm that your code passes typescript compilation and doesn't have errors before submitting.

In your code, `console.log` and `console.error` can be used to understand the execution or indicate that an error happened, but debug logs should be removed in the final version (errors can stay).

When finished, you must call `submitCode` to submit the final version of the code, then respond with "Successfully submitted code" on success. On failure, correct any errors and submit again.

---

{{DOCUMENTATION}}

{{CONTEXT}}

