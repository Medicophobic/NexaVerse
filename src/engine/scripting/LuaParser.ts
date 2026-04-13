import { Token, TokenType } from './LuaLexer';

export type ASTNode =
  | BlockNode | ChunkNode
  | AssignNode | LocalNode | DoNode
  | WhileNode | RepeatNode | IfNode
  | NumericForNode | GenericForNode
  | FunctionNode | LocalFunctionNode | ReturnNode | BreakNode
  | CallStatNode | MethodCallStatNode
  | NumberNode | StringNode | BoolNode | NilNode | VarArgNode
  | NameNode | IndexNode | FieldNode
  | BinopNode | UnopNode
  | FunctionExprNode | TableNode | TableField
  | CallExprNode | MethodCallExprNode;

export interface ChunkNode { kind: 'chunk'; block: BlockNode; }
export interface BlockNode { kind: 'block'; stmts: ASTNode[]; }
export interface AssignNode { kind: 'assign'; targets: ASTNode[]; values: ASTNode[]; }
export interface LocalNode { kind: 'local'; names: string[]; attribs: (string | null)[]; values: ASTNode[]; }
export interface DoNode { kind: 'do'; block: BlockNode; }
export interface WhileNode { kind: 'while'; cond: ASTNode; block: BlockNode; }
export interface RepeatNode { kind: 'repeat'; block: BlockNode; cond: ASTNode; }
export interface IfNode { kind: 'if'; cond: ASTNode; then: BlockNode; elseifs: { cond: ASTNode; block: BlockNode }[]; else?: BlockNode; }
export interface NumericForNode { kind: 'numericfor'; name: string; start: ASTNode; limit: ASTNode; step?: ASTNode; block: BlockNode; }
export interface GenericForNode { kind: 'genericfor'; names: string[]; iters: ASTNode[]; block: BlockNode; }
export interface FunctionNode { kind: 'function'; name: ASTNode; params: string[]; hasVarArg: boolean; block: BlockNode; }
export interface LocalFunctionNode { kind: 'localfunction'; name: string; params: string[]; hasVarArg: boolean; block: BlockNode; }
export interface ReturnNode { kind: 'return'; values: ASTNode[]; }
export interface BreakNode { kind: 'break'; }
export interface CallStatNode { kind: 'callstat'; call: CallExprNode | MethodCallExprNode; }
export interface MethodCallStatNode { kind: 'methodcallstat'; call: MethodCallExprNode; }
export interface NumberNode { kind: 'number'; value: number; }
export interface StringNode { kind: 'string'; value: string; }
export interface BoolNode { kind: 'bool'; value: boolean; }
export interface NilNode { kind: 'nil'; }
export interface VarArgNode { kind: 'vararg'; }
export interface NameNode { kind: 'name'; name: string; }
export interface IndexNode { kind: 'index'; table: ASTNode; key: ASTNode; }
export interface FieldNode { kind: 'field'; table: ASTNode; field: string; }
export interface BinopNode { kind: 'binop'; op: string; left: ASTNode; right: ASTNode; }
export interface UnopNode { kind: 'unop'; op: string; expr: ASTNode; }
export interface FunctionExprNode { kind: 'funcexpr'; params: string[]; hasVarArg: boolean; block: BlockNode; }
export interface TableNode { kind: 'table'; fields: TableField[]; }
export interface TableField { kind: 'tablefield'; key?: ASTNode; value: ASTNode; }
export interface CallExprNode { kind: 'call'; func: ASTNode; args: ASTNode[]; }
export interface MethodCallExprNode { kind: 'methodcall'; obj: ASTNode; method: string; args: ASTNode[]; }

export class LuaParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) { this.tokens = tokens; }

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private check(type: TokenType): boolean { return this.peek().type === type; }
  private match(...types: TokenType[]): boolean {
    if (types.includes(this.peek().type)) { return true; }
    return false;
  }
  private consume(type: TokenType, msg?: string): Token {
    if (this.peek().type !== type) {
      const t = this.peek();
      throw new Error(`[Lua Parser] ${msg ?? `Expected ${type}`}, got ${t.type} ('${t.value}') at line ${t.line}:${t.col}`);
    }
    return this.advance();
  }

  parse(): ChunkNode {
    const block = this.parseBlock();
    this.consume(TokenType.EOF, 'Expected end of file');
    return { kind: 'chunk', block };
  }

  private parseBlock(): BlockNode {
    const stmts: ASTNode[] = [];
    while (!this.isBlockEnd()) {
      if (this.check(TokenType.Semicolon)) { this.advance(); continue; }
      if (this.check(TokenType.Return)) { stmts.push(this.parseReturn()); if (this.check(TokenType.Semicolon)) this.advance(); break; }
      const stmt = this.parseStatement();
      if (stmt) stmts.push(stmt);
    }
    return { kind: 'block', stmts };
  }

  private isBlockEnd(): boolean {
    const t = this.peek().type;
    return t === TokenType.EOF || t === TokenType.End || t === TokenType.Else || t === TokenType.Elseif || t === TokenType.Until;
  }

  private parseStatement(): ASTNode | null {
    const t = this.peek();
    switch (t.type) {
      case TokenType.If: return this.parseIf();
      case TokenType.While: return this.parseWhile();
      case TokenType.Do: return this.parseDo();
      case TokenType.For: return this.parseFor();
      case TokenType.Repeat: return this.parseRepeat();
      case TokenType.Function: return this.parseFunctionStat();
      case TokenType.Local: return this.parseLocal();
      case TokenType.Break: this.advance(); return { kind: 'break' };
      default: return this.parseExprStat();
    }
  }

  private parseReturn(): ReturnNode {
    this.consume(TokenType.Return);
    const values: ASTNode[] = [];
    if (!this.isBlockEnd() && !this.check(TokenType.Semicolon) && !this.check(TokenType.EOF)) {
      values.push(this.parseExpr());
      while (this.check(TokenType.Comma)) { this.advance(); values.push(this.parseExpr()); }
    }
    return { kind: 'return', values };
  }

  private parseIf(): IfNode {
    this.consume(TokenType.If);
    const cond = this.parseExpr();
    this.consume(TokenType.Then);
    const then = this.parseBlock();
    const elseifs: { cond: ASTNode; block: BlockNode }[] = [];
    let elseBranch: BlockNode | undefined;
    while (this.check(TokenType.Elseif)) {
      this.advance();
      const ec = this.parseExpr();
      this.consume(TokenType.Then);
      elseifs.push({ cond: ec, block: this.parseBlock() });
    }
    if (this.check(TokenType.Else)) { this.advance(); elseBranch = this.parseBlock(); }
    this.consume(TokenType.End);
    return { kind: 'if', cond, then, elseifs, else: elseBranch };
  }

  private parseWhile(): WhileNode {
    this.consume(TokenType.While);
    const cond = this.parseExpr();
    this.consume(TokenType.Do);
    const block = this.parseBlock();
    this.consume(TokenType.End);
    return { kind: 'while', cond, block };
  }

  private parseDo(): DoNode {
    this.consume(TokenType.Do);
    const block = this.parseBlock();
    this.consume(TokenType.End);
    return { kind: 'do', block };
  }

  private parseFor(): NumericForNode | GenericForNode {
    this.consume(TokenType.For);
    const name = this.consume(TokenType.Name).value as string;
    if (this.check(TokenType.Eq)) {
      this.advance();
      const start = this.parseExpr();
      this.consume(TokenType.Comma);
      const limit = this.parseExpr();
      let step: ASTNode | undefined;
      if (this.check(TokenType.Comma)) { this.advance(); step = this.parseExpr(); }
      this.consume(TokenType.Do);
      const block = this.parseBlock();
      this.consume(TokenType.End);
      return { kind: 'numericfor', name, start, limit, step, block };
    }
    const names = [name];
    while (this.check(TokenType.Comma)) { this.advance(); names.push(this.consume(TokenType.Name).value as string); }
    this.consume(TokenType.In);
    const iters = [this.parseExpr()];
    while (this.check(TokenType.Comma)) { this.advance(); iters.push(this.parseExpr()); }
    this.consume(TokenType.Do);
    const block = this.parseBlock();
    this.consume(TokenType.End);
    return { kind: 'genericfor', names, iters, block };
  }

  private parseRepeat(): RepeatNode {
    this.consume(TokenType.Repeat);
    const block = this.parseBlock();
    this.consume(TokenType.Until);
    const cond = this.parseExpr();
    return { kind: 'repeat', block, cond };
  }

  private parseFunctionStat(): FunctionNode {
    this.consume(TokenType.Function);
    let name: ASTNode = { kind: 'name', name: this.consume(TokenType.Name).value as string };
    while (this.check(TokenType.Dot)) { this.advance(); const f = this.consume(TokenType.Name).value as string; name = { kind: 'field', table: name, field: f }; }
    let isMethod = false;
    if (this.check(TokenType.Colon)) { this.advance(); const m = this.consume(TokenType.Name).value as string; name = { kind: 'field', table: name, field: m }; isMethod = true; }
    const { params, hasVarArg } = this.parseFuncParams(isMethod);
    const block = this.parseBlock();
    this.consume(TokenType.End);
    return { kind: 'function', name, params, hasVarArg, block };
  }

  private parseLocal(): LocalNode | LocalFunctionNode {
    this.consume(TokenType.Local);
    if (this.check(TokenType.Function)) {
      this.advance();
      const name = this.consume(TokenType.Name).value as string;
      const { params, hasVarArg } = this.parseFuncParams(false);
      const block = this.parseBlock();
      this.consume(TokenType.End);
      return { kind: 'localfunction', name, params, hasVarArg, block };
    }
    const names: string[] = [this.consume(TokenType.Name).value as string];
    const attribs: (string | null)[] = [this.parseAttrib()];
    while (this.check(TokenType.Comma)) {
      this.advance();
      names.push(this.consume(TokenType.Name).value as string);
      attribs.push(this.parseAttrib());
    }
    const values: ASTNode[] = [];
    if (this.check(TokenType.Eq)) {
      this.advance();
      values.push(this.parseExpr());
      while (this.check(TokenType.Comma)) { this.advance(); values.push(this.parseExpr()); }
    }
    return { kind: 'local', names, attribs, values };
  }

  private parseAttrib(): string | null {
    if (this.check(TokenType.Lt)) { this.advance(); const a = this.consume(TokenType.Name).value as string; this.consume(TokenType.Gt); return a; }
    return null;
  }

  private parseFuncParams(isMethod: boolean): { params: string[]; hasVarArg: boolean } {
    this.consume(TokenType.LParen);
    const params: string[] = [];
    if (isMethod) params.push('self');
    let hasVarArg = false;
    if (!this.check(TokenType.RParen)) {
      if (this.check(TokenType.Ellipsis)) { this.advance(); hasVarArg = true; }
      else {
        params.push(this.consume(TokenType.Name).value as string);
        while (this.check(TokenType.Comma)) {
          this.advance();
          if (this.check(TokenType.Ellipsis)) { this.advance(); hasVarArg = true; break; }
          params.push(this.consume(TokenType.Name).value as string);
        }
      }
    }
    this.consume(TokenType.RParen);
    return { params, hasVarArg };
  }

  private parseExprStat(): ASTNode {
    const expr = this.parseSuffixedExpr();
    if (this.check(TokenType.Eq) || this.check(TokenType.Comma)) {
      const targets = [expr];
      while (this.check(TokenType.Comma)) { this.advance(); targets.push(this.parseSuffixedExpr()); }
      this.consume(TokenType.Eq);
      const values = [this.parseExpr()];
      while (this.check(TokenType.Comma)) { this.advance(); values.push(this.parseExpr()); }
      return { kind: 'assign', targets, values };
    }
    if (expr.kind === 'call') return { kind: 'callstat', call: expr };
    if (expr.kind === 'methodcall') return { kind: 'callstat', call: expr };
    throw new Error(`[Lua Parser] Unexpected expression statement: ${expr.kind}`);
  }

  private parseExpr(): ASTNode { return this.parseOr(); }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.check(TokenType.Or)) { this.advance(); left = { kind: 'binop', op: 'or', left, right: this.parseAnd() }; }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.check(TokenType.And)) { this.advance(); left = { kind: 'binop', op: 'and', left, right: this.parseComparison() }; }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseBitOr();
    const cmpOps = [TokenType.Lt, TokenType.Gt, TokenType.LtEq, TokenType.GtEq, TokenType.EqEq, TokenType.TildeEq];
    while (this.match(...cmpOps)) {
      const op = this.advance().value as string;
      left = { kind: 'binop', op, left, right: this.parseBitOr() };
    }
    return left;
  }

  private parseBitOr(): ASTNode { return this.parseConcat(); }

  private parseConcat(): ASTNode {
    const left = this.parseAddSub();
    if (this.check(TokenType.Concat)) { this.advance(); return { kind: 'binop', op: '..', left, right: this.parseConcat() }; }
    return left;
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const op = this.advance().value as string;
      left = { kind: 'binop', op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parseUnary();
    while (this.match(TokenType.Star, TokenType.Slash, TokenType.DoubleSlash, TokenType.Percent)) {
      const op = this.advance().value as string;
      left = { kind: 'binop', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.check(TokenType.Not)) { this.advance(); return { kind: 'unop', op: 'not', expr: this.parseUnary() }; }
    if (this.check(TokenType.Minus)) { this.advance(); return { kind: 'unop', op: '-', expr: this.parseUnary() }; }
    if (this.check(TokenType.Hash)) { this.advance(); return { kind: 'unop', op: '#', expr: this.parseUnary() }; }
    return this.parsePower();
  }

  private parsePower(): ASTNode {
    const left = this.parseSuffixedExpr();
    if (this.check(TokenType.Caret)) { this.advance(); return { kind: 'binop', op: '^', left, right: this.parseUnary() }; }
    return left;
  }

  private parseSuffixedExpr(): ASTNode {
    let expr = this.parsePrimaryExpr();
    while (true) {
      if (this.check(TokenType.Dot)) {
        this.advance();
        const field = this.consume(TokenType.Name).value as string;
        expr = { kind: 'field', table: expr, field };
      } else if (this.check(TokenType.LBracket)) {
        this.advance();
        const key = this.parseExpr();
        this.consume(TokenType.RBracket);
        expr = { kind: 'index', table: expr, key };
      } else if (this.check(TokenType.Colon)) {
        this.advance();
        const method = this.consume(TokenType.Name).value as string;
        const args = this.parseArgs();
        expr = { kind: 'methodcall', obj: expr, method, args };
      } else if (this.check(TokenType.LParen) || this.check(TokenType.LBrace) || this.check(TokenType.String)) {
        const args = this.parseArgs();
        expr = { kind: 'call', func: expr, args };
      } else { break; }
    }
    return expr;
  }

  private parseArgs(): ASTNode[] {
    if (this.check(TokenType.LParen)) {
      this.advance();
      if (this.check(TokenType.RParen)) { this.advance(); return []; }
      const args = [this.parseExpr()];
      while (this.check(TokenType.Comma)) { this.advance(); args.push(this.parseExpr()); }
      this.consume(TokenType.RParen);
      return args;
    }
    if (this.check(TokenType.LBrace)) return [this.parseTable()];
    if (this.check(TokenType.String)) { const t = this.advance(); return [{ kind: 'string', value: t.value as string }]; }
    throw new Error(`[Lua Parser] Expected function arguments at line ${this.peek().line}`);
  }

  private parsePrimaryExpr(): ASTNode {
    const t = this.peek();
    if (t.type === TokenType.Name) { this.advance(); return { kind: 'name', name: t.value as string }; }
    if (t.type === TokenType.LParen) {
      this.advance();
      const expr = this.parseExpr();
      this.consume(TokenType.RParen);
      return expr;
    }
    return this.parseSimpleExpr();
  }

  private parseSimpleExpr(): ASTNode {
    const t = this.peek();
    switch (t.type) {
      case TokenType.Number: this.advance(); return { kind: 'number', value: t.value as number };
      case TokenType.String: this.advance(); return { kind: 'string', value: t.value as string };
      case TokenType.Bool: this.advance(); return { kind: 'bool', value: t.value as boolean };
      case TokenType.Nil: this.advance(); return { kind: 'nil' };
      case TokenType.Ellipsis: this.advance(); return { kind: 'vararg' };
      case TokenType.Function: { this.advance(); const { params, hasVarArg } = this.parseFuncParams(false); const block = this.parseBlock(); this.consume(TokenType.End); return { kind: 'funcexpr', params, hasVarArg, block }; }
      case TokenType.LBrace: return this.parseTable();
      default: throw new Error(`[Lua Parser] Unexpected token ${t.type} ('${t.value}') at line ${t.line}:${t.col}`);
    }
  }

  private parseTable(): TableNode {
    this.consume(TokenType.LBrace);
    const fields: TableField[] = [];
    while (!this.check(TokenType.RBrace)) {
      if (this.check(TokenType.LBracket)) {
        this.advance();
        const key = this.parseExpr();
        this.consume(TokenType.RBracket);
        this.consume(TokenType.Eq);
        const value = this.parseExpr();
        fields.push({ kind: 'tablefield', key, value });
      } else if (this.check(TokenType.Name) && this.tokens[this.pos + 1]?.type === TokenType.Eq) {
        const key: StringNode = { kind: 'string', value: this.advance().value as string };
        this.advance();
        const value = this.parseExpr();
        fields.push({ kind: 'tablefield', key, value });
      } else {
        const value = this.parseExpr();
        fields.push({ kind: 'tablefield', value });
      }
      if (this.check(TokenType.Comma) || this.check(TokenType.Semicolon)) this.advance();
      else break;
    }
    this.consume(TokenType.RBrace);
    return { kind: 'table', fields };
  }
}
