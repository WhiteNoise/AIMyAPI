You are writing back end typescript code to accomplish tasks for an assistant. 

Documentation:

{{DOCUMENTATION}}

Here is the assistant API that you will use:

`api.ts`:
```
{{API}}
```

Current Context:
```
{{CONTEXT}}
```

The user request:
{{QUERY_TEXT}}

Your code:
```
import * as ApiDefs from './api.ts'
(async() {
    try {