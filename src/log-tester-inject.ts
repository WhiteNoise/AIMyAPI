type LogSource = "sandbox" | "compiler" | "runner";
type LogEntryType = "log" | "error" | "trace";

type SandboxLog = { 
  type: "log" | "error"; 
  args: any[]; 
  source: LogSource 
} | {
  type: "trace";
  fnName: string,
  fnArgs: any[],
  result: any
};

const has = Object.prototype.hasOwnProperty;

function dequal(foo: any, bar: any) {
    let ctor, len;
    if (foo === bar) return true;

    if (foo && bar && (ctor=foo.constructor) === bar.constructor) {
        if (ctor === Date) return foo.getTime() === bar.getTime();
        if (ctor === RegExp) return foo.toString() === bar.toString();

        if (ctor === Array) {
            if ((len=foo.length) === bar.length) {
                while (len-- && dequal(foo[len], bar[len]));
            }
            return len === -1;
        }

        if (!ctor || typeof foo === 'object') {
            len = 0;
            for (ctor in foo) {
                if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
                if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor])) return false;
            }
            return Object.keys(bar).length === len;
        }
    }

    return foo !== foo && bar !== bar;
}

/** Return true to pass. Returning a falsy value or throwing fails the check. */
type ArgumentsEvaluator = (args: any[]) => any;
/** Return true to pass. Returning a falsy value or throwing fails the check. */
type ResultEvaluator = (result: any) => any;

/**
 * One step in a test sequence. Gets the logs and the current position, checks
 * the entries there, and returns the position of the next unchecked entry.
 * Throws TestFailed if the check fails.
 */
type TestStep = (logs: SandboxLog[], index: number) => number;

class TestFailed extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TestFailed";
    }
}

function describeEntry(entry: SandboxLog | undefined): string {
    if (!entry) return "end of logs";
    const short = (v: any) => JSON.stringify(v);
    if (entry.type === "trace") {
        return `trace ${entry.fnName}(${entry.fnArgs.map(short).join(", ")}) -> ${short(entry.result)}`;
    }
    return `${entry.type} [${entry.source}] ${entry.args.map(short).join(" ")}`;
}

function nameMatches(pattern: string, name: string): boolean {
    return pattern === "*" || pattern === name;
}

/** Runs an evaluator and throws TestFailed if it returns falsy or throws. */
function evaluate(evaluator: ((value: any) => any) | undefined, value: any, what: string, index: number, entry: SandboxLog) {
    if (!evaluator) return;
    let passed: any;
    try {
        passed = evaluator(value);
    } catch (e: any) {
        throw new TestFailed(`Log #${index}: ${what} check threw: ${e?.message ?? e}. Entry: ${describeEntry(entry)}`);
    }
    if (!passed) {
        throw new TestFailed(`Log #${index}: ${what} check failed. Entry: ${describeEntry(entry)}`);
    }
}

function checkTrace(logs: SandboxLog[], index: number, functionName: string, argumentsEvaluator?: ArgumentsEvaluator, resultEvaluator?: ResultEvaluator) {
    const entry = logs[index];
    if (!entry || entry.type !== "trace" || !nameMatches(functionName, entry.fnName)) {
        throw new TestFailed(`Log #${index}: expected trace for "${functionName}", got ${describeEntry(entry)}`);
    }
    evaluate(argumentsEvaluator, entry.fnArgs, `arguments of "${entry.fnName}"`, index, entry);
    evaluate(resultEvaluator, entry.result, `result of "${entry.fnName}"`, index, entry);
}

function expectEntryType(type: "log" | "error", argumentsEvaluator?: ArgumentsEvaluator): TestStep {
    return (logs, index) => {
        const entry = logs[index];
        if (!entry || entry.type !== type) {
            throw new TestFailed(`Log #${index}: expected ${type}, got ${describeEntry(entry)}`);
        }
        evaluate(argumentsEvaluator, entry.args, `${type} arguments`, index, entry);
        return index + 1;
    };
}

/**
 * Checks the logs from a sandbox run against an expected sequence of entries.
 *
 * @example
 * test.sequence(
 *     test.expectTrace("getSalesData"),
 *     test.expectTrace("display", (args) => args[0].includes("The month with the highest sales was")),
 * );
 */
class LogTester {
    private source: SandboxLog[];

    constructor(source: SandboxLog[]) {
        this.source = source;
    }

    private get logs(): SandboxLog[] {
        return this.source;
    }

    /**
     * Runs the steps in order, starting at the first log entry. Throws TestFailed
     * on the first failing step. Entries after the last step are ignored.
     * Accepts steps as separate arguments or as one array.
     */
    sequence(...steps: (TestStep | TestStep[])[]): true {
        const logs = this.logs;
        let index = 0;
        for (const step of steps.flat()) {
            if (typeof step !== "function") {
                throw new TestFailed(`sequence() expects test steps (e.g. test.expectTrace(...)), got ${typeof step}`);
            }
            index = step(logs, index);
        }
        return true;
    }

    /** Next entry must be a trace for `functionName` ("*" for any function). */
    expectTrace(functionName: string, argumentsEvaluator?: ArgumentsEvaluator, resultEvaluator?: ResultEvaluator): TestStep {
        return (logs, index) => {
            checkTrace(logs, index, functionName, argumentsEvaluator, resultEvaluator);
            return index + 1;
        };
    }

    /** Next entry can be anything, but there must be one. */
    expectAny(): TestStep {
        return (logs, index) => {
            if (index >= logs.length) {
                throw new TestFailed(`Log #${index}: expected any entry, got end of logs`);
            }
            return index + 1;
        };
    }

    /** Skips ahead to just before the next trace for `functionName` ("*" for any). Fails if there is none. */
    skipToTrace(functionName: string): TestStep {
        return (logs, index) => {
            for (let i = index; i < logs.length; i++) {
                const entry = logs[i];
                if (entry.type === "trace" && nameMatches(functionName, entry.fnName)) {
                    return i;
                }
            }
            throw new TestFailed(`Log #${index}: no trace for "${functionName}" found from here to the end of the logs`);
        };
    }

    /**
     * Consecutive traces for `functionName` ("*" for any).
     * With `num` > 0, exactly that many must be next (more are left for later steps).
     * With `num` 0 or undefined, takes as many as are next, including none.
     * The evaluators are checked against every matched trace.
     */
    expectMultipleTraces(functionName: string, num?: number, argumentsEvaluator?: ArgumentsEvaluator, resultEvaluator?: ResultEvaluator): TestStep {
        return (logs, index) => {
            if (num && num > 0) {
                for (let n = 0; n < num; n++) {
                    const entry = logs[index + n];
                    if (!entry || entry.type !== "trace" || !nameMatches(functionName, entry.fnName)) {
                        throw new TestFailed(`Log #${index + n}: expected ${num} traces for "${functionName}" but found ${n}. Got ${describeEntry(entry)}`);
                    }
                    checkTrace(logs, index + n, functionName, argumentsEvaluator, resultEvaluator);
                }
                return index + num;
            }

            let i = index;
            while (i < logs.length) {
                const entry = logs[i];
                if (entry.type !== "trace" || !nameMatches(functionName, entry.fnName)) break;
                checkTrace(logs, i, functionName, argumentsEvaluator, resultEvaluator);
                i++;
            }
            return i;
        };
    }

    /** Next entry must be a log (console.log etc). The evaluator gets the logged arguments. */
    expectLog(argumentsEvaluator?: ArgumentsEvaluator): TestStep {
        return expectEntryType("log", argumentsEvaluator);
    }

    /** Next entry must be an error. The evaluator gets the error arguments. */
    expectError(argumentsEvaluator?: ArgumentsEvaluator): TestStep {
        return expectEntryType("error", argumentsEvaluator);
    }

    /** Deep equality. Returns true if equal, otherwise throws TestFailed, so it works inside evaluators. */
    equals(actual: any, expected: any): true {
        if (!dequal(actual, expected)) {
            throw new TestFailed(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
        return true;
    }
}


// const test = new LogTester(logs);
// test.sequence(
//     test.expectTrace("display", (args) => args[0][0].sales == 100)
// )
// console.log("success");