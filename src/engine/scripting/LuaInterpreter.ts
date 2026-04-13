import {
  ASTNode, BlockNode, ChunkNode,
} from './LuaParser';

export type LuaValue = null | boolean | number | string | LuaTable | LuaFunction | LuaUserdata;

export class LuaTable {
  private _array: LuaValue[] = [];
  private _hash: Map<string | number | boolean, LuaValue> = new Map();
  metatable: LuaTable | null = null;

  get(key: LuaValue): LuaValue {
    if (typeof key === 'number' && Number.isInteger(key) && key >= 1 && key <= this._array.length) {
      return this._array[key - 1] ?? null;
    }
    if (key === null || key === undefined) return null;
    const v = this._hash.get(key as string | number | boolean);
    if (v === undefined) {
      if (this.metatable) {
        const idx = this.metatable.get('__index');
        if (idx instanceof LuaTable) return idx.get(key);
        if (typeof idx === 'function' || idx instanceof LuaFunction) return null;
      }
      return null;
    }
    return v;
  }

  set(key: LuaValue, value: LuaValue): void {
    if (key === null) throw new Error('table index is nil');
    if (typeof key === 'number' && Number.isInteger(key) && key >= 1) {
      if (value === null) { this._array[key - 1] = null; return; }
      if (key <= this._array.length + 1) { this._array[key - 1] = value; this._rehash(); return; }
    }
    if (value === null) { this._hash.delete(key as string | number | boolean); return; }
    this._hash.set(key as string | number | boolean, value);
  }

  private _rehash(): void {
    while (this._array.length > 0 && this._array[this._array.length - 1] === null) {
      this._array.pop();
    }
  }

  length(): number { return this._array.length; }

  next(key: LuaValue): [LuaValue, LuaValue] | null {
    if (key === null) {
      if (this._array.length > 0) return [1, this._array[0]];
      const first = this._hash.entries().next();
      if (!first.done) return [first.value[0], first.value[1]];
      return null;
    }
    if (typeof key === 'number' && Number.isInteger(key) && key >= 1 && key <= this._array.length) {
      for (let i = key; i < this._array.length; i++) {
        if (this._array[i] !== null) return [i + 1, this._array[i]];
      }
      const first = this._hash.entries().next();
      if (!first.done) return [first.value[0], first.value[1]];
      return null;
    }
    const entries = Array.from(this._hash.entries());
    const idx = entries.findIndex(([k]) => k === key);
    if (idx >= 0 && idx < entries.length - 1) return [entries[idx + 1][0], entries[idx + 1][1]];
    return null;
  }

  pairs(): [LuaValue, LuaValue][] {
    const result: [LuaValue, LuaValue][] = [];
    for (let i = 0; i < this._array.length; i++) {
      if (this._array[i] !== null) result.push([i + 1, this._array[i]]);
    }
    for (const [k, v] of this._hash) result.push([k, v]);
    return result;
  }

  ipairs(): [number, LuaValue][] {
    const result: [number, LuaValue][] = [];
    for (let i = 0; i < this._array.length; i++) {
      if (this._array[i] === null) break;
      result.push([i + 1, this._array[i]]);
    }
    return result;
  }
}

export class LuaFunction {
  constructor(
    public readonly params: string[],
    public readonly hasVarArg: boolean,
    public readonly block: BlockNode,
    public readonly closure: LuaEnvironment,
    public readonly name?: string,
  ) {}
}

export class LuaUserdata {
  constructor(public readonly value: unknown, public readonly type: string = 'userdata') {}
}

class BreakSignal { static readonly instance = new BreakSignal(); }
class ReturnSignal { constructor(public readonly values: LuaValue[]) {} }
class ContinueSignal { static readonly instance = new ContinueSignal(); }

export class LuaEnvironment {
  private _vars: Map<string, LuaValue> = new Map();
  constructor(public readonly parent: LuaEnvironment | null = null) {}

  get(name: string): LuaValue {
    if (this._vars.has(name)) return this._vars.get(name) ?? null;
    if (this.parent) return this.parent.get(name);
    return null;
  }

  set(name: string, value: LuaValue): void {
    if (this._vars.has(name)) { this._vars.set(name, value); return; }
    if (this.parent && this.parent._has(name)) { this.parent.set(name, value); return; }
    if (this.parent) { this.parent.set(name, value); return; }
    this._vars.set(name, value);
  }

  setLocal(name: string, value: LuaValue): void { this._vars.set(name, value); }

  setGlobal(name: string, value: LuaValue): void {
    if (!this.parent) { this._vars.set(name, value); return; }
    this.parent.setGlobal(name, value);
  }

  private _has(name: string): boolean {
    if (this._vars.has(name)) return true;
    if (this.parent) return this.parent._has(name);
    return false;
  }
}

export class LuaInterpreter {
  private _globals: LuaEnvironment;
  private _callDepth = 0;
  private _maxCallDepth = 200;
  private _stepCount = 0;
  private _maxSteps = 1_000_000;
  readonly outputLog: string[] = [];

  constructor(globals: LuaEnvironment) {
    this._globals = globals;
  }

  private _step(): void {
    if (++this._stepCount > this._maxSteps) throw new Error('Script exceeded maximum instruction limit');
  }

  execute(node: ChunkNode): LuaValue[] {
    const result = this._execBlock(node.block, new LuaEnvironment(this._globals));
    if (result instanceof ReturnSignal) return result.values;
    return [];
  }

  private _execBlock(block: BlockNode, env: LuaEnvironment): ReturnSignal | BreakSignal | ContinueSignal | null {
    for (const stmt of block.stmts) {
      this._step();
      const result = this._execStmt(stmt, env);
      if (result instanceof ReturnSignal || result instanceof BreakSignal || result instanceof ContinueSignal) return result;
    }
    return null;
  }

  private _execStmt(node: ASTNode, env: LuaEnvironment): ReturnSignal | BreakSignal | ContinueSignal | null {
    switch (node.kind) {
      case 'assign': {
        const values = this._evalExprList(node.values, env);
        for (let i = 0; i < node.targets.length; i++) {
          this._assign(node.targets[i], values[i] ?? null, env);
        }
        return null;
      }
      case 'local': {
        const values = this._evalExprList(node.values, env);
        for (let i = 0; i < node.names.length; i++) {
          env.setLocal(node.names[i], values[i] ?? null);
        }
        return null;
      }
      case 'do': return this._execBlock(node.block, new LuaEnvironment(env));
      case 'while': {
        while (this._luaTruth(this._evalExpr(node.cond, env))) {
          this._step();
          const r = this._execBlock(node.block, new LuaEnvironment(env));
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
        }
        return null;
      }
      case 'repeat': {
        while (true) {
          this._step();
          const loopEnv = new LuaEnvironment(env);
          const r = this._execBlock(node.block, loopEnv);
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
          if (this._luaTruth(this._evalExpr(node.cond, loopEnv))) break;
        }
        return null;
      }
      case 'if': {
        if (this._luaTruth(this._evalExpr(node.cond, env))) {
          return this._execBlock(node.then, new LuaEnvironment(env));
        }
        for (const ei of node.elseifs) {
          if (this._luaTruth(this._evalExpr(ei.cond, env))) {
            return this._execBlock(ei.block, new LuaEnvironment(env));
          }
        }
        if (node.else) return this._execBlock(node.else, new LuaEnvironment(env));
        return null;
      }
      case 'numericfor': {
        let i = this._toNumber(this._evalExpr(node.start, env)) ?? 0;
        const limit = this._toNumber(this._evalExpr(node.limit, env)) ?? 0;
        const step = node.step ? (this._toNumber(this._evalExpr(node.step, env)) ?? 1) : 1;
        if (step === 0) throw new Error("'for' step is zero");
        while (step > 0 ? i <= limit : i >= limit) {
          this._step();
          const loopEnv = new LuaEnvironment(env);
          loopEnv.setLocal(node.name, i);
          const r = this._execBlock(node.block, loopEnv);
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
          i += step;
        }
        return null;
      }
      case 'genericfor': {
        const [iterFn, state, initialCtl] = this._evalExprList(node.iters, env);
        let ctl = initialCtl ?? null;
        while (true) {
          this._step();
          const results = this._callFunc(iterFn, [state, ctl]);
          if (!results.length || results[0] === null) break;
          ctl = results[0];
          const loopEnv = new LuaEnvironment(env);
          for (let i = 0; i < node.names.length; i++) loopEnv.setLocal(node.names[i], results[i] ?? null);
          const r = this._execBlock(node.block, loopEnv);
          if (r instanceof BreakSignal) break;
          if (r instanceof ReturnSignal) return r;
        }
        return null;
      }
      case 'function': {
        const fn = new LuaFunction(node.params, node.hasVarArg, node.block, env);
        this._assign(node.name, fn, env);
        return null;
      }
      case 'localfunction': {
        const fn = new LuaFunction(node.params, node.hasVarArg, node.block, env, node.name);
        env.setLocal(node.name, fn);
        return null;
      }
      case 'return': {
        const values = this._evalExprList(node.values, env);
        return new ReturnSignal(values);
      }
      case 'break': return BreakSignal.instance;
      case 'callstat': {
        this._evalExpr(node.call, env);
        return null;
      }
      default: {
        const e = node as ASTNode;
        if ('kind' in e) this._evalExpr(e, env);
        return null;
      }
    }
  }

  _evalExprList(exprs: ASTNode[], env: LuaEnvironment): LuaValue[] {
    if (exprs.length === 0) return [];
    const results: LuaValue[] = [];
    for (let i = 0; i < exprs.length - 1; i++) {
      results.push(this._evalExpr(exprs[i], env));
    }
    const last = exprs[exprs.length - 1];
    const lastVal = this._evalExprMulti(last, env);
    results.push(...lastVal);
    return results;
  }

  private _evalExprMulti(node: ASTNode, env: LuaEnvironment): LuaValue[] {
    if (node.kind === 'call') {
      const fn = this._evalExpr(node.func, env);
      const args = this._evalExprList(node.args, env);
      return this._callFunc(fn, args);
    }
    if (node.kind === 'methodcall') {
      const obj = this._evalExpr(node.obj, env);
      const method = this._getField(obj, node.method);
      const args = this._evalExprList(node.args, env);
      return this._callFunc(method, [obj, ...args]);
    }
    if (node.kind === 'vararg') {
      const va = env.get('...') as LuaTable | null;
      if (va instanceof LuaTable) return va.ipairs().map(([, v]) => v);
      return [];
    }
    return [this._evalExpr(node, env)];
  }

  _evalExpr(node: ASTNode, env: LuaEnvironment): LuaValue {
    this._step();
    switch (node.kind) {
      case 'number': return node.value;
      case 'string': return node.value;
      case 'bool': return node.value;
      case 'nil': return null;
      case 'vararg': {
        const va = env.get('...') as LuaTable | null;
        if (va instanceof LuaTable) return va.get(1);
        return null;
      }
      case 'name': return env.get(node.name);
      case 'field': {
        const tbl = this._evalExpr(node.table, env);
        return this._getField(tbl, node.field);
      }
      case 'index': {
        const tbl = this._evalExpr(node.table, env);
        const key = this._evalExpr(node.key, env);
        return this._getIndex(tbl, key);
      }
      case 'call': {
        const fn = this._evalExpr(node.func, env);
        const args = this._evalExprList(node.args, env);
        const r = this._callFunc(fn, args);
        return r[0] ?? null;
      }
      case 'methodcall': {
        const obj = this._evalExpr(node.obj, env);
        const method = this._getField(obj, node.method);
        const args = this._evalExprList(node.args, env);
        const r = this._callFunc(method, [obj, ...args]);
        return r[0] ?? null;
      }
      case 'binop': return this._evalBinop(node.op, node.left, node.right, env);
      case 'unop': return this._evalUnop(node.op, node.expr, env);
      case 'funcexpr': return new LuaFunction(node.params, node.hasVarArg, node.block, env);
      case 'table': {
        const tbl = new LuaTable();
        let arrayIdx = 1;
        for (const field of node.fields) {
          if (field.key) {
            const k = this._evalExpr(field.key, env);
            const v = this._evalExpr(field.value, env);
            tbl.set(k, v);
          } else {
            tbl.set(arrayIdx++, this._evalExpr(field.value, env));
          }
        }
        return tbl;
      }
      default: throw new Error(`[Lua] Unknown expression kind: ${(node as ASTNode).kind}`);
    }
  }

  private _getField(obj: LuaValue, field: string): LuaValue {
    if (obj instanceof LuaTable) return obj.get(field);
    if (obj instanceof LuaUserdata) {
      const v = (obj.value as Record<string, unknown>)?.[field];
      if (typeof v === 'function') return new LuaUserdata(v, 'method');
      if (v instanceof LuaTable || v instanceof LuaFunction || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) return v as LuaValue;
      if (v !== undefined) return new LuaUserdata(v);
      return null;
    }
    throw new Error(`attempt to index ${this._typeName(obj)} value`);
  }

  private _getIndex(obj: LuaValue, key: LuaValue): LuaValue {
    if (obj instanceof LuaTable) return obj.get(key);
    throw new Error(`attempt to index ${this._typeName(obj)} value`);
  }

  private _assign(target: ASTNode, value: LuaValue, env: LuaEnvironment): void {
    if (target.kind === 'name') { env.set(target.name, value); return; }
    if (target.kind === 'field') {
      const tbl = this._evalExpr(target.table, env);
      if (tbl instanceof LuaTable) { tbl.set(target.field, value); return; }
      if (tbl instanceof LuaUserdata) {
        (tbl.value as Record<string, unknown>)[target.field] = this._unwrap(value);
        return;
      }
      throw new Error(`attempt to index ${this._typeName(tbl)} value`);
    }
    if (target.kind === 'index') {
      const tbl = this._evalExpr(target.table, env);
      const key = this._evalExpr(target.key, env);
      if (tbl instanceof LuaTable) { tbl.set(key, value); return; }
      throw new Error(`attempt to index ${this._typeName(tbl)} value`);
    }
    throw new Error(`[Lua] Cannot assign to ${target.kind}`);
  }

  _callFunc(fn: LuaValue, args: LuaValue[]): LuaValue[] {
    if (++this._callDepth > this._maxCallDepth) {
      this._callDepth--;
      throw new Error('stack overflow');
    }
    try {
      if (fn instanceof LuaFunction) {
        const fnEnv = new LuaEnvironment(fn.closure);
        for (let i = 0; i < fn.params.length; i++) {
          fnEnv.setLocal(fn.params[i], args[i] ?? null);
        }
        if (fn.hasVarArg) {
          const va = new LuaTable();
          const extra = args.slice(fn.params.length);
          for (let i = 0; i < extra.length; i++) va.set(i + 1, extra[i]);
          fnEnv.setLocal('...', va);
        }
        const result = this._execBlock(fn.block, fnEnv);
        if (result instanceof ReturnSignal) return result.values;
        return [];
      }
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        const unwrapped = args.map(a => this._unwrap(a));
        const result = (fn.value as (...a: unknown[]) => unknown)(...unwrapped);
        if (result === undefined || result === null) return [];
        if (Array.isArray(result)) return result.map(v => this._wrap(v));
        return [this._wrap(result)];
      }
      if (typeof fn === 'function') {
        const result = (fn as (...a: unknown[]) => unknown)(...args.map(a => this._unwrap(a)));
        if (result === undefined || result === null) return [];
        if (Array.isArray(result)) return result.map(v => this._wrap(v));
        return [this._wrap(result)];
      }
      if (fn instanceof LuaTable) {
        const call = fn.get('__call');
        if (call) return this._callFunc(call, [fn, ...args]);
      }
      throw new Error(`attempt to call a ${this._typeName(fn)} value`);
    } finally {
      this._callDepth--;
    }
  }

  _wrap(v: unknown): LuaValue {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return v;
    if (v instanceof LuaTable || v instanceof LuaFunction || v instanceof LuaUserdata) return v;
    if (typeof v === 'function') return new LuaUserdata(v, 'function');
    if (typeof v === 'object') return new LuaUserdata(v);
    return null;
  }

  _unwrap(v: LuaValue): unknown {
    if (v instanceof LuaUserdata) return v.value;
    if (v instanceof LuaTable) return v;
    return v;
  }

  private _typeName(v: LuaValue): string {
    if (v === null) return 'nil';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (v instanceof LuaTable) return 'table';
    if (v instanceof LuaFunction) return 'function';
    if (v instanceof LuaUserdata) return v.type;
    return 'unknown';
  }

  private _luaTruth(v: LuaValue): boolean {
    return v !== null && v !== false;
  }

  private _toNumber(v: LuaValue): number | null {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
    return null;
  }

  private _evalBinop(op: string, left: ASTNode, right: ASTNode, env: LuaEnvironment): LuaValue {
    if (op === 'and') { const l = this._evalExpr(left, env); return this._luaTruth(l) ? this._evalExpr(right, env) : l; }
    if (op === 'or') { const l = this._evalExpr(left, env); return this._luaTruth(l) ? l : this._evalExpr(right, env); }
    const l = this._evalExpr(left, env);
    const r = this._evalExpr(right, env);
    switch (op) {
      case '+': return (this._toNumber(l) ?? 0) + (this._toNumber(r) ?? 0);
      case '-': return (this._toNumber(l) ?? 0) - (this._toNumber(r) ?? 0);
      case '*': return (this._toNumber(l) ?? 0) * (this._toNumber(r) ?? 0);
      case '/': return (this._toNumber(l) ?? 0) / (this._toNumber(r) ?? 1);
      case '//': return Math.floor((this._toNumber(l) ?? 0) / (this._toNumber(r) ?? 1));
      case '%': return ((this._toNumber(l) ?? 0) % (this._toNumber(r) ?? 1) + (this._toNumber(r) ?? 1)) % (this._toNumber(r) ?? 1);
      case '^': return Math.pow(this._toNumber(l) ?? 0, this._toNumber(r) ?? 1);
      case '..': return this._luaToString(l) + this._luaToString(r);
      case '==': return l === r || (typeof l === 'number' && typeof r === 'number' && l === r);
      case '~=': return l !== r;
      case '<': return (this._toNumber(l) ?? 0) < (this._toNumber(r) ?? 0);
      case '>': return (this._toNumber(l) ?? 0) > (this._toNumber(r) ?? 0);
      case '<=': return (this._toNumber(l) ?? 0) <= (this._toNumber(r) ?? 0);
      case '>=': return (this._toNumber(l) ?? 0) >= (this._toNumber(r) ?? 0);
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private _evalUnop(op: string, expr: ASTNode, env: LuaEnvironment): LuaValue {
    const v = this._evalExpr(expr, env);
    switch (op) {
      case '-': return -(this._toNumber(v) ?? 0);
      case 'not': return !this._luaTruth(v);
      case '#': {
        if (typeof v === 'string') return v.length;
        if (v instanceof LuaTable) return v.length();
        throw new Error(`attempt to get length of ${this._typeName(v)} value`);
      }
      default: throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  _luaToString(v: LuaValue): string {
    if (v === null) return 'nil';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (v instanceof LuaTable) return 'table';
    if (v instanceof LuaFunction) return `function`;
    if (v instanceof LuaUserdata) return `${v.type}`;
    return 'nil';
  }
}
