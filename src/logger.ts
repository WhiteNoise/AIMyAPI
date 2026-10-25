export type LogSource = "sandbox" | "compiler" | "runner";
export type LogEntryType = "log" | "error" | "trace";

export type SandboxTrace = {
  type: "trace";
  fnName: string,
  fnArgs: any[],
  result: any
};

export type SandboxLogOrError = { 
  type: "log" | "error"; 
  args: any[]; 
  source: LogSource 
}

export type SandboxLogEntry = SandboxLogOrError | SandboxTrace;

export class Logger {
  private logs: SandboxLogEntry[] = [];
  debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  getLogs() {
    return this.logs;
  }
  
  addEntry(type: "log" | "error", args: any, source: LogSource) {
    if(Array.isArray(args)) {
      this.logs.push({ type, args, source });
    } else {      
      this.logs.push({ type, args: [args], source });
    }
  }
  log(args: any, source: LogSource) {
    this.addEntry("log", args, source);
    if (this.debug) {
      console.log(`[${source}]:`, ...args);
    }    
  }
  trace(fnName: string, fnArgs: any[], result: any) {
    //this.addEntry("trace", Logger.limitObjectForLogs(args, 5, 5), source);
    this.logs.push({ type: "trace", fnName, fnArgs, result })
    if (this.debug) {
      console.debug(`[sandbox]: ${fnName}(${fnArgs.map(arg => JSON.stringify(Logger.limitObjectForLogs(arg))).join(",")}) -> ${JSON.stringify(Logger.limitObjectForLogs(result))}`);
    }    
  }  
  error(args: any, source: LogSource) {
    this.addEntry("error", args, source);
    
    if (this.debug) {
      console.error(`[${source}]:`, ...args);
    }    
  }

  clear() {
    this.logs = [];
  }

  getPrettyLogs() {
    return this.logs.map(entry => Logger.limitObjectForLogs(entry))
  }

  /**
   * Returns a trimmed copy of `value` that is safe to log.
   * - Objects/arrays nested deeper than `maxDepth` become "[Object]" / "[Array(n)]".
   * - Arrays longer than `maxArrayItems` keep the first items plus a "+N more items" string.
   * - Circular references become "[Circular]".
   */
  static limitObjectForLogs(value: any, maxDepth: number = 3, maxArrayItems: number = 5): any {
    const seen = new WeakSet<object>();

    const trim = (val: any, depth: number): any => {
      if (val === null || typeof val !== "object") {
        if (typeof val === "function") return `[Function${val.name ? `: ${val.name}` : ""}]`;
        if (typeof val === "bigint") return `${val}n`;
        if (typeof val === "symbol") return val.toString();
        return val;
      }

      if (val instanceof Date) return val.toISOString();
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }

      if (seen.has(val)) return "[Circular]";

      if (depth >= maxDepth) {
        return Array.isArray(val) ? `[Array(${val.length})]` : "[Object]";
      }

      seen.add(val);
      let result: any;

      if (Array.isArray(val)) {
        result = val.slice(0, maxArrayItems).map((item) => trim(item, depth + 1));
        if (val.length > maxArrayItems) {
          result.push(`+${val.length - maxArrayItems} more items`);
        }
      } else {
        result = {};
        for (const key of Object.keys(val)) {
          result[key] = trim(val[key], depth + 1);
        }
      }

      // Only track the current path, so shared (non-circular) references still print.
      seen.delete(val);
      return result;
    };

    return trim(value, 0);
  }
}
