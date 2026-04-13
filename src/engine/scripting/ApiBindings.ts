import { LuaEnvironment, LuaTable, LuaValue, LuaUserdata } from './LuaInterpreter';
import { Instance } from '../core/Instance';
import { createInstance } from '../core/EngineObjects';
import { Signal } from '../core/Signal';

function wrapSignal(signal: Signal<unknown[]>): LuaTable {
  const tbl = new LuaTable();
  tbl.set('Connect', new LuaUserdata((callback: LuaValue) => {
    const conn = signal.connect((...args: unknown[]) => {
      if (callback instanceof LuaUserdata && typeof callback.value === 'function') {
        (callback.value as (...a: unknown[]) => void)(...args);
      }
    });
    const connTbl = new LuaTable();
    connTbl.set('Disconnect', new LuaUserdata(() => conn.disconnect()));
    connTbl.set('Connected', true);
    return [connTbl];
  }, 'function'));
  tbl.set('Wait', new LuaUserdata(() => {
    return [null];
  }, 'function'));
  tbl.set('Once', new LuaUserdata((callback: LuaValue) => {
    signal.once((...args: unknown[]) => {
      if (callback instanceof LuaUserdata && typeof callback.value === 'function') {
        (callback.value as (...a: unknown[]) => void)(...args);
      }
    });
    return [];
  }, 'function'));
  return tbl;
}

export function wrapInstance(instance: Instance): LuaTable {
  const tbl = new LuaTable();

  tbl.set('Name', instance.name);
  tbl.set('ClassName', instance.className);
  tbl.set('Parent', null);

  tbl.set('GetChildren', new LuaUserdata(() => {
    const arr = new LuaTable();
    const children = instance.getChildren();
    children.forEach((child, i) => arr.set(i + 1, wrapInstance(child)));
    return [arr];
  }, 'function'));

  tbl.set('GetDescendants', new LuaUserdata(() => {
    const arr = new LuaTable();
    instance.getDescendants().forEach((d, i) => arr.set(i + 1, wrapInstance(d)));
    return [arr];
  }, 'function'));

  tbl.set('FindFirstChild', new LuaUserdata((name: LuaValue, recursive: LuaValue) => {
    const found = instance.findFirstChild(String(name), Boolean(recursive));
    return [found ? wrapInstance(found) : null];
  }, 'function'));

  tbl.set('FindFirstChildOfClass', new LuaUserdata((cls: LuaValue) => {
    const found = instance.findFirstChildOfClass(String(cls));
    return [found ? wrapInstance(found) : null];
  }, 'function'));

  tbl.set('WaitForChild', new LuaUserdata((name: LuaValue) => {
    const found = instance.findFirstChild(String(name));
    return [found ? wrapInstance(found) : null];
  }, 'function'));

  tbl.set('Destroy', new LuaUserdata(() => {
    instance.destroy();
    return [];
  }, 'function'));

  tbl.set('Clone', new LuaUserdata(() => {
    return [wrapInstance(instance.clone())];
  }, 'function'));

  tbl.set('IsA', new LuaUserdata((cls: LuaValue) => {
    return [instance.className === String(cls)];
  }, 'function'));

  tbl.set('IsDescendantOf', new LuaUserdata((ancestor: LuaValue) => {
    if (ancestor instanceof LuaTable) {
      return [false];
    }
    return [false];
  }, 'function'));

  tbl.set('GetAttribute', new LuaUserdata((name: LuaValue) => {
    return [instance.getAttribute(String(name)) as LuaValue];
  }, 'function'));

  tbl.set('SetAttribute', new LuaUserdata((name: LuaValue, value: LuaValue) => {
    instance.setAttribute(String(name), value);
    return [];
  }, 'function'));

  tbl.set('Changed', wrapSignal(instance.Changed as Signal<unknown[]>));
  tbl.set('ChildAdded', wrapSignal(instance.ChildAdded as Signal<unknown[]>));
  tbl.set('ChildRemoved', wrapSignal(instance.ChildRemoved as Signal<unknown[]>));
  tbl.set('Destroying', wrapSignal(instance.Destroying as Signal<unknown[]>));

  const props = (instance as { _properties?: Map<string, LuaValue> })._properties;
  if (props) {
    for (const [k, v] of props) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        tbl.set(k, v);
      }
    }
  }

  return tbl;
}

export function buildStdlib(output: (s: string) => void): LuaEnvironment {
  const env = new LuaEnvironment(null);

  env.setLocal('print', new LuaUserdata((...args: unknown[]) => {
    const str = args.map(a => {
      if (a === null || a === undefined) return 'nil';
      if (a instanceof LuaTable) return 'table';
      return String(a);
    }).join('\t');
    output(str);
    return [];
  }, 'function'));

  env.setLocal('warn', new LuaUserdata((...args: unknown[]) => {
    output('[WARN] ' + args.join('\t'));
    return [];
  }, 'function'));

  env.setLocal('error', new LuaUserdata((msg: unknown, _level: unknown) => {
    throw new Error(String(msg));
  }, 'function'));

  env.setLocal('assert', new LuaUserdata((v: unknown, msg: unknown) => {
    if (!v) throw new Error(String(msg ?? 'assertion failed'));
    return [v];
  }, 'function'));

  env.setLocal('tostring', new LuaUserdata((v: unknown) => {
    if (v === null || v === undefined) return ['nil'];
    if (v instanceof LuaTable) return ['table'];
    return [String(v)];
  }, 'function'));

  env.setLocal('tonumber', new LuaUserdata((v: unknown, base: unknown) => {
    const n = parseFloat(String(v));
    return [isNaN(n) ? null : n];
  }, 'function'));

  env.setLocal('type', new LuaUserdata((v: unknown) => {
    if (v === null || v === undefined) return ['nil'];
    if (typeof v === 'boolean') return ['boolean'];
    if (typeof v === 'number') return ['number'];
    if (typeof v === 'string') return ['string'];
    if (v instanceof LuaTable) return ['table'];
    if (v instanceof LuaUserdata) return [v.type === 'function' ? 'function' : 'userdata'];
    return ['nil'];
  }, 'function'));

  env.setLocal('ipairs', new LuaUserdata((tbl: unknown) => {
    if (!(tbl instanceof LuaTable)) return [null];
    let i = 0;
    const iter = new LuaUserdata(() => {
      i++;
      const v = tbl.get(i);
      if (v === null) return [null];
      return [i, v];
    }, 'function');
    return [iter, tbl, 0];
  }, 'function'));

  env.setLocal('pairs', new LuaUserdata((tbl: unknown) => {
    if (!(tbl instanceof LuaTable)) return [null];
    const entries = tbl.pairs();
    let idx = 0;
    const iter = new LuaUserdata(() => {
      if (idx >= entries.length) return [null];
      const [k, v] = entries[idx++];
      return [k, v];
    }, 'function');
    return [iter, tbl, null];
  }, 'function'));

  env.setLocal('next', new LuaUserdata((tbl: unknown, key: unknown) => {
    if (!(tbl instanceof LuaTable)) return [null];
    const result = tbl.next(key as LuaValue);
    if (!result) return [null];
    return result;
  }, 'function'));

  env.setLocal('select', new LuaUserdata((index: unknown, ...args: unknown[]) => {
    if (index === '#') return [args.length];
    const i = typeof index === 'number' ? index : parseInt(String(index));
    return args.slice(i - 1);
  }, 'function'));

  env.setLocal('unpack', new LuaUserdata((tbl: unknown, i: unknown, j: unknown) => {
    if (!(tbl instanceof LuaTable)) return [];
    const start = typeof i === 'number' ? i : 1;
    const end = typeof j === 'number' ? j : tbl.length();
    const result: LuaValue[] = [];
    for (let k = start; k <= end; k++) result.push(tbl.get(k));
    return result;
  }, 'function'));

  env.setLocal('rawget', new LuaUserdata((tbl: unknown, key: unknown) => {
    if (tbl instanceof LuaTable) return [tbl.get(key as LuaValue)];
    return [null];
  }, 'function'));

  env.setLocal('rawset', new LuaUserdata((tbl: unknown, key: unknown, value: unknown) => {
    if (tbl instanceof LuaTable) tbl.set(key as LuaValue, value as LuaValue);
    return [tbl];
  }, 'function'));

  env.setLocal('setmetatable', new LuaUserdata((tbl: unknown, mt: unknown) => {
    if (tbl instanceof LuaTable && (mt instanceof LuaTable || mt === null)) {
      tbl.metatable = mt as LuaTable | null;
    }
    return [tbl];
  }, 'function'));

  env.setLocal('getmetatable', new LuaUserdata((tbl: unknown) => {
    if (tbl instanceof LuaTable) return [tbl.metatable];
    return [null];
  }, 'function'));

  env.setLocal('pcall', new LuaUserdata((fn: unknown, ...args: unknown[]) => {
    try {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        const result = (fn.value as (...a: unknown[]) => unknown)(...args);
        if (Array.isArray(result)) return [true, ...result];
        return [true, result];
      }
      return [false, 'not a function'];
    } catch (e) {
      return [false, String(e instanceof Error ? e.message : e)];
    }
  }, 'function'));

  env.setLocal('xpcall', new LuaUserdata((fn: unknown, handler: unknown, ...args: unknown[]) => {
    try {
      if (fn instanceof LuaUserdata && typeof fn.value === 'function') {
        const result = (fn.value as (...a: unknown[]) => unknown)(...args);
        if (Array.isArray(result)) return [true, ...result];
        return [true, result];
      }
      return [false, 'not a function'];
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (handler instanceof LuaUserdata && typeof handler.value === 'function') {
        (handler.value as (m: string) => void)(msg);
      }
      return [false, msg];
    }
  }, 'function'));

  const mathLib = new LuaTable();
  mathLib.set('pi', Math.PI);
  mathLib.set('huge', Infinity);
  mathLib.set('abs', new LuaUserdata((n: unknown) => [Math.abs(n as number)], 'function'));
  mathLib.set('ceil', new LuaUserdata((n: unknown) => [Math.ceil(n as number)], 'function'));
  mathLib.set('floor', new LuaUserdata((n: unknown) => [Math.floor(n as number)], 'function'));
  mathLib.set('round', new LuaUserdata((n: unknown) => [Math.round(n as number)], 'function'));
  mathLib.set('sqrt', new LuaUserdata((n: unknown) => [Math.sqrt(n as number)], 'function'));
  mathLib.set('sin', new LuaUserdata((n: unknown) => [Math.sin(n as number)], 'function'));
  mathLib.set('cos', new LuaUserdata((n: unknown) => [Math.cos(n as number)], 'function'));
  mathLib.set('tan', new LuaUserdata((n: unknown) => [Math.tan(n as number)], 'function'));
  mathLib.set('atan', new LuaUserdata((y: unknown, x: unknown) => [Math.atan2(y as number, (x as number) ?? 1)], 'function'));
  mathLib.set('atan2', new LuaUserdata((y: unknown, x: unknown) => [Math.atan2(y as number, x as number)], 'function'));
  mathLib.set('max', new LuaUserdata((...args: unknown[]) => [Math.max(...(args as number[]))], 'function'));
  mathLib.set('min', new LuaUserdata((...args: unknown[]) => [Math.min(...(args as number[]))], 'function'));
  mathLib.set('random', new LuaUserdata((m: unknown, n: unknown) => {
    if (m === undefined || m === null) return [Math.random()];
    if (n === undefined || n === null) return [Math.floor(Math.random() * (m as number)) + 1];
    return [Math.floor(Math.random() * ((n as number) - (m as number) + 1)) + (m as number)];
  }, 'function'));
  mathLib.set('randomseed', new LuaUserdata(() => [], 'function'));
  mathLib.set('pow', new LuaUserdata((b: unknown, e: unknown) => [Math.pow(b as number, e as number)], 'function'));
  mathLib.set('log', new LuaUserdata((n: unknown, base: unknown) => {
    if (base) return [Math.log(n as number) / Math.log(base as number)];
    return [Math.log(n as number)];
  }, 'function'));
  mathLib.set('exp', new LuaUserdata((n: unknown) => [Math.exp(n as number)], 'function'));
  mathLib.set('clamp', new LuaUserdata((n: unknown, min: unknown, max: unknown) => [Math.max(min as number, Math.min(max as number, n as number))], 'function'));
  mathLib.set('sign', new LuaUserdata((n: unknown) => [Math.sign(n as number)], 'function'));
  mathLib.set('fmod', new LuaUserdata((a: unknown, b: unknown) => [(a as number) % (b as number)], 'function'));
  env.setLocal('math', mathLib);

  const stringLib = new LuaTable();
  stringLib.set('len', new LuaUserdata((s: unknown) => [String(s).length], 'function'));
  stringLib.set('sub', new LuaUserdata((s: unknown, i: unknown, j: unknown) => {
    const str = String(s);
    const start = (i as number) > 0 ? (i as number) - 1 : Math.max(0, str.length + (i as number));
    const end = j === undefined || j === null ? undefined : ((j as number) >= 0 ? (j as number) : str.length + (j as number) + 1);
    return [str.slice(start, end)];
  }, 'function'));
  stringLib.set('upper', new LuaUserdata((s: unknown) => [String(s).toUpperCase()], 'function'));
  stringLib.set('lower', new LuaUserdata((s: unknown) => [String(s).toLowerCase()], 'function'));
  stringLib.set('rep', new LuaUserdata((s: unknown, n: unknown, sep: unknown) => [Array(n as number).fill(String(s)).join(sep ? String(sep) : '')], 'function'));
  stringLib.set('reverse', new LuaUserdata((s: unknown) => [String(s).split('').reverse().join('')], 'function'));
  stringLib.set('byte', new LuaUserdata((s: unknown, i: unknown) => [String(s).charCodeAt(((i as number) ?? 1) - 1)], 'function'));
  stringLib.set('char', new LuaUserdata((...codes: unknown[]) => [codes.map(c => String.fromCharCode(c as number)).join('')], 'function'));
  stringLib.set('format', new LuaUserdata((fmt: unknown, ...args: unknown[]) => {
    let i = 0;
    const result = String(fmt).replace(/%([diouxXeEfgGsq%])/g, (_, spec) => {
      if (spec === '%') return '%';
      const val = args[i++];
      if (spec === 'd' || spec === 'i') return Math.floor(val as number).toString();
      if (spec === 'f') return (val as number).toFixed(6);
      if (spec === 's') return String(val ?? '');
      if (spec === 'x') return Math.floor(val as number).toString(16);
      if (spec === 'X') return Math.floor(val as number).toString(16).toUpperCase();
      return String(val);
    });
    return [result];
  }, 'function'));
  stringLib.set('find', new LuaUserdata((s: unknown, pattern: unknown, init: unknown, plain: unknown) => {
    const str = String(s);
    const pat = String(pattern);
    const start = ((init as number) ?? 1) - 1;
    if (plain) {
      const idx = str.indexOf(pat, start);
      if (idx < 0) return [null];
      return [idx + 1, idx + pat.length];
    }
    try {
      const re = new RegExp(pat.replace(/%(.)/g, (_, c) => {
        const map: Record<string, string> = { d: '\\d', w: '\\w', s: '\\s', a: '[a-zA-Z]', l: '[a-z]', u: '[A-Z]' };
        return map[c] || (c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }));
      const m = str.slice(start).match(re);
      if (!m || m.index === undefined) return [null];
      return [m.index + start + 1, m.index + start + m[0].length];
    } catch { return [null]; }
  }, 'function'));
  stringLib.set('match', new LuaUserdata((s: unknown, pattern: unknown) => {
    const str = String(s);
    try {
      const re = new RegExp(String(pattern));
      const m = str.match(re);
      if (!m) return [null];
      return m.slice(1).length > 0 ? m.slice(1) : [m[0]];
    } catch { return [null]; }
  }, 'function'));
  stringLib.set('gmatch', new LuaUserdata((s: unknown, pattern: unknown) => {
    const str = String(s);
    let pos = 0;
    const iter = new LuaUserdata(() => {
      if (pos >= str.length) return [null];
      try {
        const re = new RegExp(String(pattern), 'g');
        re.lastIndex = pos;
        const m = re.exec(str);
        if (!m) return [null];
        pos = re.lastIndex;
        return m.slice(1).length > 0 ? m.slice(1) : [m[0]];
      } catch { return [null]; }
    }, 'function');
    return [iter];
  }, 'function'));
  env.setLocal('string', stringLib);

  const tableLib = new LuaTable();
  tableLib.set('insert', new LuaUserdata((tbl: unknown, posOrVal: unknown, val: unknown) => {
    if (!(tbl instanceof LuaTable)) return [];
    if (val === undefined) { const len = tbl.length(); tbl.set(len + 1, posOrVal as LuaValue); }
    else { tbl.set(posOrVal as number, val as LuaValue); }
    return [];
  }, 'function'));
  tableLib.set('remove', new LuaUserdata((tbl: unknown, pos: unknown) => {
    if (!(tbl instanceof LuaTable)) return [null];
    const len = tbl.length();
    const idx = (pos as number) ?? len;
    const val = tbl.get(idx);
    for (let i = idx; i < len; i++) tbl.set(i, tbl.get(i + 1));
    tbl.set(len, null);
    return [val];
  }, 'function'));
  tableLib.set('concat', new LuaUserdata((tbl: unknown, sep: unknown, i: unknown, j: unknown) => {
    if (!(tbl instanceof LuaTable)) return [''];
    const start = (i as number) ?? 1;
    const end = (j as number) ?? tbl.length();
    const parts: string[] = [];
    for (let k = start; k <= end; k++) parts.push(String(tbl.get(k) ?? ''));
    return [parts.join(String(sep ?? ''))];
  }, 'function'));
  tableLib.set('sort', new LuaUserdata((tbl: unknown, comp: unknown) => {
    if (!(tbl instanceof LuaTable)) return [];
    const arr = tbl.ipairs().map(([, v]) => v);
    arr.sort((a, b) => {
      if (comp instanceof LuaUserdata && typeof comp.value === 'function') {
        const r = (comp.value as (a: unknown, b: unknown) => unknown)(a, b);
        return r ? -1 : 1;
      }
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a) < String(b) ? -1 : 1;
    });
    for (let i = 0; i < arr.length; i++) tbl.set(i + 1, arr[i]);
    return [];
  }, 'function'));
  tableLib.set('unpack', new LuaUserdata((tbl: unknown) => {
    if (!(tbl instanceof LuaTable)) return [];
    return tbl.ipairs().map(([, v]) => v);
  }, 'function'));
  env.setLocal('table', tableLib);

  const osLib = new LuaTable();
  osLib.set('time', new LuaUserdata(() => [Math.floor(Date.now() / 1000)], 'function'));
  osLib.set('clock', new LuaUserdata(() => [performance.now() / 1000], 'function'));
  osLib.set('date', new LuaUserdata(() => [new Date().toISOString()], 'function'));
  env.setLocal('os', osLib);

  env.setLocal('Instance', new LuaTable());
  const instanceLib = env.get('Instance') as LuaTable;
  instanceLib.set('new', new LuaUserdata((className: unknown, parent: unknown) => {
    const inst = createInstance(String(className));
    const wrapped = wrapInstance(inst);
    if (parent instanceof LuaTable) {
      wrapped.set('Parent', parent);
    }
    return [wrapped];
  }, 'function'));

  env.setLocal('Vector3', new LuaTable());
  const vec3Lib = env.get('Vector3') as LuaTable;
  vec3Lib.set('new', new LuaUserdata((x: unknown, y: unknown, z: unknown) => {
    const tbl = new LuaTable();
    tbl.set('X', (x as number) ?? 0);
    tbl.set('Y', (y as number) ?? 0);
    tbl.set('Z', (z as number) ?? 0);
    tbl.set('x', (x as number) ?? 0);
    tbl.set('y', (y as number) ?? 0);
    tbl.set('z', (z as number) ?? 0);
    tbl.set('Magnitude', Math.sqrt(((x as number) ?? 0) ** 2 + ((y as number) ?? 0) ** 2 + ((z as number) ?? 0) ** 2));
    return [tbl];
  }, 'function'));

  env.setLocal('Color3', new LuaTable());
  const color3Lib = env.get('Color3') as LuaTable;
  color3Lib.set('new', new LuaUserdata((r: unknown, g: unknown, b: unknown) => {
    const tbl = new LuaTable();
    tbl.set('R', (r as number) ?? 0);
    tbl.set('G', (g as number) ?? 0);
    tbl.set('B', (b as number) ?? 0);
    return [tbl];
  }, 'function'));
  color3Lib.set('fromRGB', new LuaUserdata((r: unknown, g: unknown, b: unknown) => {
    const tbl = new LuaTable();
    tbl.set('R', ((r as number) ?? 0) / 255);
    tbl.set('G', ((g as number) ?? 0) / 255);
    tbl.set('B', ((b as number) ?? 0) / 255);
    return [tbl];
  }, 'function'));

  return env;
}
