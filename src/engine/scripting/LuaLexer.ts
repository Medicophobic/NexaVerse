export enum TokenType {
  Number = 'Number', String = 'String', Bool = 'Bool', Nil = 'Nil',
  Name = 'Name', Dot = 'Dot', Colon = 'Colon', Comma = 'Comma',
  Semicolon = 'Semicolon', Hash = 'Hash', Ellipsis = 'Ellipsis',
  Plus = 'Plus', Minus = 'Minus', Star = 'Star', Slash = 'Slash',
  DoubleSlash = 'DoubleSlash', Percent = 'Percent', Caret = 'Caret',
  Concat = 'Concat', EqEq = 'EqEq', TildeEq = 'TildeEq', Lt = 'Lt',
  Gt = 'Gt', LtEq = 'LtEq', GtEq = 'GtEq', Eq = 'Eq',
  LParen = 'LParen', RParen = 'RParen', LBracket = 'LBracket',
  RBracket = 'RBracket', LBrace = 'LBrace', RBrace = 'RBrace',
  And = 'And', Or = 'Or', Not = 'Not',
  If = 'If', Then = 'Then', Else = 'Else', Elseif = 'Elseif',
  End = 'End', Do = 'Do', While = 'While', Repeat = 'Repeat',
  Until = 'Until', For = 'For', In = 'In', Return = 'Return',
  Break = 'Break', Continue = 'Continue', Function = 'Function',
  Local = 'Local', Nil2 = 'Nil2',
  EOF = 'EOF',
}

const KEYWORDS: Record<string, TokenType> = {
  and: TokenType.And, or: TokenType.Or, not: TokenType.Not,
  if: TokenType.If, then: TokenType.Then, else: TokenType.Else,
  elseif: TokenType.Elseif, end: TokenType.End, do: TokenType.Do,
  while: TokenType.While, repeat: TokenType.Repeat, until: TokenType.Until,
  for: TokenType.For, in: TokenType.In, return: TokenType.Return,
  break: TokenType.Break, continue: TokenType.Continue,
  function: TokenType.Function, local: TokenType.Local,
  nil: TokenType.Nil, true: TokenType.Bool, false: TokenType.Bool,
};

export interface Token {
  type: TokenType;
  value: string | number | boolean | null;
  line: number;
  col: number;
}

export class LuaLexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;
      const tok = this.nextToken();
      if (tok) tokens.push(tok);
    }
    tokens.push({ type: TokenType.EOF, value: null, line: this.line, col: this.col });
    return tokens;
  }

  private peek(offset = 0): string { return this.source[this.pos + offset] ?? ''; }
  private advance(): string {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance(); continue;
      }
      if (ch === '-' && this.peek(1) === '-') {
        this.pos += 2; this.col += 2;
        if (this.peek() === '[') {
          const level = this.countLongBracket();
          if (level >= 0) { this.readLongString(level); continue; }
        }
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }
      break;
    }
  }

  private countLongBracket(): number {
    let i = 1; let level = 0;
    while (this.source[this.pos + i] === '=') { level++; i++; }
    if (this.source[this.pos + i] === '[') return level;
    return -1;
  }

  private readLongString(level: number): string {
    const open = '[' + '='.repeat(level) + '[';
    const close = ']' + '='.repeat(level) + ']';
    this.pos += open.length; this.col += open.length;
    let result = '';
    while (this.pos < this.source.length) {
      if (this.source.startsWith(close, this.pos)) {
        this.pos += close.length; this.col += close.length;
        return result;
      }
      result += this.advance();
    }
    throw new Error(`Unterminated long string at line ${this.line}`);
  }

  private nextToken(): Token | null {
    const line = this.line, col = this.col;
    const ch = this.peek();

    if (ch === '[') {
      const level = this.countLongBracket();
      if (level >= 0) {
        const str = this.readLongString(level);
        return { type: TokenType.String, value: str, line, col };
      }
    }

    if (ch >= '0' && ch <= '9' || (ch === '.' && this.peek(1) >= '0' && this.peek(1) <= '9')) {
      return this.readNumber(line, col);
    }

    if (ch === '"' || ch === "'") return this.readString(line, col);

    if (ch === '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      return this.readName(line, col);
    }

    this.advance();
    switch (ch) {
      case '+': return { type: TokenType.Plus, value: '+', line, col };
      case '-': return { type: TokenType.Minus, value: '-', line, col };
      case '*': return { type: TokenType.Star, value: '*', line, col };
      case '/':
        if (this.peek() === '/') { this.advance(); return { type: TokenType.DoubleSlash, value: '//', line, col }; }
        return { type: TokenType.Slash, value: '/', line, col };
      case '%': return { type: TokenType.Percent, value: '%', line, col };
      case '^': return { type: TokenType.Caret, value: '^', line, col };
      case '#': return { type: TokenType.Hash, value: '#', line, col };
      case '&': return { type: TokenType.And, value: '&', line, col };
      case '=':
        if (this.peek() === '=') { this.advance(); return { type: TokenType.EqEq, value: '==', line, col }; }
        return { type: TokenType.Eq, value: '=', line, col };
      case '<':
        if (this.peek() === '=') { this.advance(); return { type: TokenType.LtEq, value: '<=', line, col }; }
        return { type: TokenType.Lt, value: '<', line, col };
      case '>':
        if (this.peek() === '=') { this.advance(); return { type: TokenType.GtEq, value: '>=', line, col }; }
        return { type: TokenType.Gt, value: '>', line, col };
      case '~':
        if (this.peek() === '=') { this.advance(); return { type: TokenType.TildeEq, value: '~=', line, col }; }
        throw new Error(`Unexpected char '~' at ${line}:${col}`);
      case '.':
        if (this.peek() === '.') {
          this.advance();
          if (this.peek() === '.') { this.advance(); return { type: TokenType.Ellipsis, value: '...', line, col }; }
          return { type: TokenType.Concat, value: '..', line, col };
        }
        return { type: TokenType.Dot, value: '.', line, col };
      case ':': return { type: TokenType.Colon, value: ':', line, col };
      case ',': return { type: TokenType.Comma, value: ',', line, col };
      case ';': return { type: TokenType.Semicolon, value: ';', line, col };
      case '(': return { type: TokenType.LParen, value: '(', line, col };
      case ')': return { type: TokenType.RParen, value: ')', line, col };
      case '[': return { type: TokenType.LBracket, value: '[', line, col };
      case ']': return { type: TokenType.RBracket, value: ']', line, col };
      case '{': return { type: TokenType.LBrace, value: '{', line, col };
      case '}': return { type: TokenType.RBrace, value: '}', line, col };
      default: throw new Error(`Unexpected character '${ch}' at ${line}:${col}`);
    }
  }

  private readNumber(line: number, col: number): Token {
    let num = '';
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      num += this.advance() + this.advance();
      while (/[0-9a-fA-F_]/.test(this.peek())) num += this.advance();
    } else {
      while (/[0-9_]/.test(this.peek())) num += this.advance();
      if (this.peek() === '.' && this.peek(1) !== '.') { num += this.advance(); while (/[0-9]/.test(this.peek())) num += this.advance(); }
      if (this.peek() === 'e' || this.peek() === 'E') {
        num += this.advance();
        if (this.peek() === '+' || this.peek() === '-') num += this.advance();
        while (/[0-9]/.test(this.peek())) num += this.advance();
      }
    }
    return { type: TokenType.Number, value: parseFloat(num.replace(/_/g, '')), line, col };
  }

  private readString(line: number, col: number): Token {
    const quote = this.advance();
    let str = '';
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'n': str += '\n'; break; case 't': str += '\t'; break;
          case 'r': str += '\r'; break; case '\\': str += '\\'; break;
          case '"': str += '"'; break; case "'": str += "'"; break;
          case '0': str += '\0'; break;
          default: str += esc;
        }
      } else { str += this.advance(); }
    }
    if (this.peek() !== quote) throw new Error(`Unterminated string at ${line}:${col}`);
    this.advance();
    return { type: TokenType.String, value: str, line, col };
  }

  private readName(line: number, col: number): Token {
    let name = '';
    while (/[a-zA-Z0-9_]/.test(this.peek())) name += this.advance();
    const kwType = KEYWORDS[name];
    if (kwType !== undefined) {
      if (kwType === TokenType.Bool) return { type: TokenType.Bool, value: name === 'true', line, col };
      if (kwType === TokenType.Nil) return { type: TokenType.Nil, value: null, line, col };
      return { type: kwType, value: name, line, col };
    }
    return { type: TokenType.Name, value: name, line, col };
  }
}
