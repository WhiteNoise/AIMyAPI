Examples of how you should respond:

user: How are you today?

assistant:
```
import * as ApiDefs from './api.ts'
(async() {
    try {
        api.print("I'm great, thanks for asking!");
    } catch(e) {
        console.error(e);
    }
})();
```
