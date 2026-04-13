import { LuaLexer } from './LuaLexer';
import { LuaParser } from './LuaParser';
import { LuaInterpreter, LuaEnvironment, LuaTable, LuaValue, LuaUserdata } from './LuaInterpreter';
import { buildStdlib, wrapInstance } from './ApiBindings';
import { Instance } from '../core/Instance';

export interface ScriptExecutionResult {
  success: boolean;
  error?: string;
  output: string[];
  returnValues: LuaValue[];
  executionTime: number;
}

export interface ScriptContext {
  script: Instance;
  environment: 'server' | 'client';
  services: Record<string, LuaTable>;
}

export class LuaEngine {
  private _globals: LuaEnvironment;
  private _services: Map<string, LuaTable> = new Map();
  private _outputLog: string[] = [];
  private _maxOutputLines = 1000;

  constructor() {
    this._globals = buildStdlib((s) => {
      this._outputLog.push(s);
      if (this._outputLog.length > this._maxOutputLines) {
        this._outputLog.shift();
      }
    });
    this._setupEngineServices();
  }

  private _setupEngineServices(): void {
    const taskLib = new LuaTable();
    taskLib.set('wait', new LuaUserdata((duration: unknown) => {
      return [duration ?? 0];
    }, 'function'));
    taskLib.set('spawn', new LuaUserdata((fn: unknown) => {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        setTimeout(() => {
          try { (fn.value as () => void)(); } catch (e) { console.error('[LuaEngine] task.spawn error:', e); }
        }, 0);
      }
      return [];
    }, 'function'));
    taskLib.set('delay', new LuaUserdata((duration: unknown, fn: unknown) => {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        setTimeout(() => {
          try { (fn.value as () => void)(); } catch (e) { console.error('[LuaEngine] task.delay error:', e); }
        }, ((duration as number) ?? 0) * 1000);
      }
      return [];
    }, 'function'));
    this._globals.setLocal('task', taskLib);

    this._globals.setLocal('wait', new LuaUserdata((duration: unknown) => {
      return [(duration as number) ?? 0];
    }, 'function'));

    this._globals.setLocal('delay', new LuaUserdata((duration: unknown, fn: unknown) => {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        setTimeout(() => {
          try { (fn.value as () => void)(); } catch (e) {}
        }, ((duration as number) ?? 0) * 1000);
      }
      return [];
    }, 'function'));

    this._globals.setLocal('spawn', new LuaUserdata((fn: unknown) => {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        setTimeout(() => { try { (fn.value as () => void)(); } catch (e) {} }, 0);
      }
      return [];
    }, 'function'));

    this._globals.setLocal('coroutine', this._buildCoroutineLib());
  }

  private _buildCoroutineLib(): LuaTable {
    const lib = new LuaTable();
    lib.set('create', new LuaUserdata((fn: unknown) => {
      const co = { fn, status: 'suspended' as string };
      return [new LuaUserdata(co, 'thread')];
    }, 'function'));
    lib.set('wrap', new LuaUserdata((fn: unknown) => {
      let started = false;
      const wrapper = new LuaUserdata((...args: unknown[]) => {
        if (!started) {
          started = true;
          if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
            return (fn.value as (...a: unknown[]) => unknown)(...args);
          }
        }
        return [null];
      }, 'function');
      return [wrapper];
    }, 'function'));
    lib.set('resume', new LuaUserdata((co: unknown, ...args: unknown[]) => {
      if (co instanceof LuaUserdata && typeof co.value === 'object' && co.value !== null) {
        const thread = co.value as { fn: unknown; status: string };
        try {
          if (thread.fn instanceof LuaUserdata && typeof thread.fn.value === 'function') {
            const result = (thread.fn.value as (...a: unknown[]) => unknown)(...args);
            return [true, ...(Array.isArray(result) ? result : [result])];
          }
        } catch (e) {
          return [false, String(e instanceof Error ? e.message : e)];
        }
      }
      return [false, 'cannot resume'];
    }, 'function'));
    lib.set('status', new LuaUserdata((co: unknown) => {
      if (co instanceof LuaUserdata && typeof co.value === 'object' && co.value !== null) {
        return [(co.value as { status: string }).status ?? 'dead'];
      }
      return ['dead'];
    }, 'function'));
    lib.set('isyieldable', new LuaUserdata(() => [false], 'function'));
    return lib;
  }

  registerService(name: string, service: LuaTable): void {
    this._services.set(name, service);
    this._globals.setLocal(name, service);
  }

  registerInstance(name: string, instance: Instance): void {
    this._globals.setLocal(name, wrapInstance(instance));
  }

  registerValue(name: string, value: LuaValue): void {
    this._globals.setLocal(name, value);
  }

  execute(source: string, scriptName = 'script'): ScriptExecutionResult {
    const start = performance.now();
    const output: string[] = [];
    const localOutput: string[] = [];

    const localGlobals = new LuaEnvironment(this._globals);
    const printFn = new LuaUserdata((...args: unknown[]) => {
      const str = args.map(a => a === null || a === undefined ? 'nil' : String(a)).join('\t');
      localOutput.push(str);
      output.push(str);
      return [];
    }, 'function');
    localGlobals.setLocal('print', printFn);
    localGlobals.setLocal('_SCRIPT_NAME', scriptName);

    try {
      const lexer = new LuaLexer(source);
      const tokens = lexer.tokenize();
      const parser = new LuaParser(tokens);
      const ast = parser.parse();
      const interpreter = new LuaInterpreter(localGlobals);
      const returnValues = interpreter.execute(ast);
      return {
        success: true,
        output: localOutput,
        returnValues,
        executionTime: performance.now() - start,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error,
        output: localOutput,
        returnValues: [],
        executionTime: performance.now() - start,
      };
    }
  }

  createSandboxedEnvironment(permissions: string[] = []): LuaEnvironment {
    const sandbox = new LuaEnvironment(null);
    const allowed = new Set(permissions.length > 0 ? permissions : [
      'print', 'warn', 'error', 'assert', 'tostring', 'tonumber', 'type',
      'pairs', 'ipairs', 'next', 'select', 'unpack', 'rawget', 'rawset',
      'setmetatable', 'getmetatable', 'pcall', 'xpcall',
      'math', 'string', 'table', 'os', 'coroutine',
      'Vector3', 'Color3', 'Instance', 'task', 'wait', 'delay', 'spawn',
    ]);
    for (const name of allowed) {
      const val = this._globals.get(name);
      if (val !== null) sandbox.setLocal(name, val);
    }
    return sandbox;
  }

  get outputLog(): string[] { return [...this._outputLog]; }
  clearOutput(): void { this._outputLog = []; }
}
