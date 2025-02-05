import { assert, stdin, stdout, stderr, SysClose, SysDup2, SysSpawnvpe, Entrypoint, makeSequence, SysWaitpid, 
  SysChdir, SysGetcwd, SysWriteAll, SysSetenv, createDefaultRecord, SysExecvpe, SysPipe, Process, Executable, 
  SysSpawn, shallowCopy, SysExec, SysRead, SysGetenv, SysEnvironment, SysOpen, OpenFlags, 
  unreachable} from "../../internal";
import { Rosh, RoshContext, exitSymbol } from "./rosh";
import { Environment, EnvVariable } from "./env";
import { ParNamesOperator, UnAritOperator, BinAritOperator, GlobOperator, CaseOperator, BinCmdOperator, RedirOperator } from "./mvdanEnum";
import { Buffer } from 'buffer';
import unescapeJs from 'unescape-js';
import { ArithmCmd, ArithmExp, ArithmExpr, ArrayExpr, Assign, BinaryArithm, BinaryCmd, Block, BraceExp, CallExpr, CaseClause, 
  CmdSubst, Command, CoprocClause, CStyleLoop, DblQuoted, DeclClause, ExtGlob, ForClause, IfClause, LetClause, Lit, 
  ParamExp, ParenArithm, ProcSubst, Redirect, SglQuoted, Stmt, Subshell, syntax, TestClause, TestDecl, UnaryArithm, WhileClause, Word, WordIter, WordPart } from "mvdan-sh";
import { evalBracketCommand } from "./bracket";
import chalk from "chalk";

const isValidVarName = (name: string): boolean => {
  const regex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return regex.test(name);
}

const isValidInteger = (value: string): boolean => {
  const num = parseFloat(value);
  return !isNaN(num) && Number.isInteger(num) && num.toString() === value;
}

const parseEnvVars = (input: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const assignments = input.split(/\s+/);

  for (let assignment of assignments) {
    const [key, value] = assignment.split('=');
    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

const caseWildcard2Regex = (pattern: string) => {
  pattern = pattern.replace(/(?<!\\)\?/g, ".").replace(/(?<!\\)\*/g, ".*").replace(/(?<!\\)\[!/g, "[^");
  return new RegExp(`^${pattern}$`);
}

export const resolveArithmExpr = async (ctx: RoshContext, expr: ArithmExpr): Promise<EnvVariable> => {
  switch (syntax.NodeType(expr)) {
    case 'BinaryArithm': {
      const binArithm = expr as BinaryArithm;
      const xVar = await resolveArithmExpr(ctx, binArithm.X);
      const yVar = await resolveArithmExpr(ctx, binArithm.Y);
      const x = xVar.number;
      const y = yVar.number;

      let resVar: EnvVariable;
      switch (binArithm.Op as number) {
        case BinAritOperator.Add:
          return EnvVariable.fromNumber(x + y);
        case BinAritOperator.Sub:
          return EnvVariable.fromNumber(x - y);
        case BinAritOperator.Mul:
          return EnvVariable.fromNumber(x * y);
        case BinAritOperator.Quo:
          return EnvVariable.fromNumber(x / y);
        case BinAritOperator.Rem:
          return EnvVariable.fromNumber(x % y);
        case BinAritOperator.Pow:
          return EnvVariable.fromNumber(x ** y);
        case BinAritOperator.Eql:
          return EnvVariable.fromNumber(Number(x === y));
        case BinAritOperator.Gtr:
          return EnvVariable.fromNumber(Number(x > y));
        case BinAritOperator.Lss:
          return EnvVariable.fromNumber(Number(x < y));
        case BinAritOperator.Neq:
          return EnvVariable.fromNumber(Number(x !== y));
        case BinAritOperator.Leq:
          return EnvVariable.fromNumber(Number(x <= y));
        case BinAritOperator.Geq:
          return EnvVariable.fromNumber(Number(x >= y));
        case BinAritOperator.And:
          return EnvVariable.fromNumber(Number(x & y));
        case BinAritOperator.Or:
          return EnvVariable.fromNumber(Number(x | y));
        case BinAritOperator.Xor:
          return EnvVariable.fromNumber(Number(x ^ y));
        case BinAritOperator.Shr:
          return EnvVariable.fromNumber(Number(x >> y));
        case BinAritOperator.Shl:
          return EnvVariable.fromNumber(Number(x << y));
        case BinAritOperator.AndArit:
          return EnvVariable.fromNumber(Number(x && y));
        case BinAritOperator.OrArit:
          return EnvVariable.fromNumber(Number(x || y));
        case BinAritOperator.Comma:
          return EnvVariable.fromNumber(y); // TODO
        case BinAritOperator.TernQuest: {
          const colonY = binArithm.Y as BinaryArithm;
          const colonYX = (await resolveArithmExpr(ctx, colonY.X)).number;
          const colonYY = (await resolveArithmExpr(ctx, colonY.Y)).number;
          return EnvVariable.fromNumber(x ? colonYX : colonYY);
        }
        case BinAritOperator.TernColon: // handled in TernQuest
          return EnvVariable.fromNumber(0);
        case BinAritOperator.Assgn:
          resVar ??= EnvVariable.fromNumber(xVar.number = y);
        case BinAritOperator.AddAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number += y);
        case BinAritOperator.SubAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number -= y);
        case BinAritOperator.MulAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number *= y);
        case BinAritOperator.QuoAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number /= y);
        case BinAritOperator.RemAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number %= y);
        case BinAritOperator.AndAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number &= y);
        case BinAritOperator.OrAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number |= y);
        case BinAritOperator.XorAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number ^= y);
        case BinAritOperator.ShlAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number <<= y);
        case BinAritOperator.ShrAssgn:
          resVar ??= EnvVariable.fromNumber(xVar.number >>= y);
          xVar.isSysEnv() && await ctx.rosh.execSyscall(SysSetenv(xVar.name, xVar.string, true));
          return resVar;
        default:
          throw new Error('never reach');
      }
    }
    case 'UnaryArithm': {
      const unaArithm = expr as UnaryArithm;
      const xVar = await resolveArithmExpr(ctx, unaArithm.X);
      const x = xVar.number;
      let resVar: EnvVariable;
      switch (unaArithm.Op as number) {
        case UnAritOperator.Not:
          return EnvVariable.fromNumber(Number(!x));
        case UnAritOperator.BitNegation:
          return EnvVariable.fromNumber(~x);
        case UnAritOperator.Inc:
          resVar ??= EnvVariable.fromNumber(unaArithm.Post ? xVar.number++ : ++xVar.number);
        case UnAritOperator.Dec:
          resVar ??= EnvVariable.fromNumber(unaArithm.Post ? xVar.number-- : --xVar.number);
          xVar.isSysEnv() && await ctx.rosh.execSyscall(SysSetenv(xVar.name, xVar.string, true));
          return resVar;
        case UnAritOperator.Plus:
          return EnvVariable.fromNumber(+x);
        case UnAritOperator.Minus:
          return EnvVariable.fromNumber(-x);
        default:
          throw new Error('never reach');
      }
    }
    case 'ParenArithm': {
      const parArithm = expr as ParenArithm;
      return await resolveArithmExpr(ctx, parArithm.X);
    }
    case 'Word': {
      const word = expr as Word;
      const wordStr = await resolveWord(ctx, word);
      if (isValidVarName(wordStr)) {
        const envVar = ctx.env.get(wordStr);
        return envVar;
      }

      if (isValidInteger(wordStr)) {
        return EnvVariable.fromString(wordStr);
      }

      throw new Error('invalid expression');
    }
    default:
      throw new Error('never reach');
  }
}

export const resolveWordpart = async (ctx: RoshContext, part: WordPart): Promise<EnvVariable> => {
  const { rosh, env } = ctx;
  switch (syntax.NodeType(part)) {
    case 'Lit': {
      const lit = part as Lit;
      return EnvVariable.fromString(lit.Value);
    }
    case 'SglQuoted': {
      const quoted = part as SglQuoted;
      if (quoted.Dollar) {
        return EnvVariable.fromString(unescapeJs(quoted.Value));
      }
      return EnvVariable.fromString(quoted.Value);
    }
    case 'DblQuoted': {
      const quoted = part as DblQuoted;
      let partStr = '';
      for (const subPart of quoted.Parts) {
        partStr += (await resolveWordpart(ctx, subPart)).string;
      }
      return EnvVariable.fromString(partStr);
    }
    case 'ParamExp': {
      const param = part as ParamExp;
      let envVar = env.get(param.Param!.Value);

      console.log('ParamExp', envVar);

      if (param.Index) {
        const index = (await resolveArithmExpr(ctx, param.Index)).number;
        console.log('index', index);
        assert(index >= 0, `rosh: ${param.Param!.Value}: bad array subscript`);
        if (envVar.isString()) {
          if (index > 0) {
            envVar.array = createDefaultRecord<number, EnvVariable>(() => EnvVariable.fromString(''), { 0: EnvVariable.from(envVar) });
            envVar = envVar.array[index];
          }
        } else if (envVar.isArray()) {
          envVar = envVar.array[index];
        } else {
          envVar = envVar.associative[index];
        }
      }

      if (param.Length) {
        let len: number;
        if (envVar.isArray()) {
          len = Object.keys(envVar.array).length;
        } else if (envVar.isAssociative()) {
          len = Object.keys(envVar.associative).length;
        } else {
          len = envVar.string.length;
        }
        envVar = EnvVariable.fromNumber(len);
      }

      if (param.Excl) {
        if (param.Names) {
          const varNames = env.names().filter(name => name.startsWith(param.Param!.Value));
          switch (param.Names as number) {
            case ParNamesOperator.NamesPrefix:
              envVar = EnvVariable.fromString(varNames.join(' '));
              break;
            case ParNamesOperator.NamesPrefixWords:
              envVar = EnvVariable.fromArray(varNames.map(name => EnvVariable.fromString(name)));
              break;
          }
        } else {
          envVar = env.get(envVar.string);
        }
      }

      return envVar;
    }
    case 'ArithmExp': {
      const exp = part as ArithmExp;
      return resolveArithmExpr(ctx, exp.X);
    }
    case 'BraceExp': {
      const exp = part as BraceExp;
      let resolved: Array<EnvVariable> = [];

      for (const word of exp.Elems) {
        resolved.push(EnvVariable.fromString(await resolveWord(ctx, word!)));
      }

      if (exp.Sequence) {
        const [start, end] = resolved.map(x => x.number);
        return EnvVariable.fromArray(makeSequence(start, end).map(num => EnvVariable.fromNumber(num)));
      } else {
        return EnvVariable.fromArray(resolved);
      }
    }
    case 'ExtGlob': { // TODO
      const glob = part as ExtGlob;
      let regex: string;
      switch (glob.Op as number) {
        case GlobOperator.GlobZeroOrOne:
          regex = `(${glob.Pattern!})?`;
          break;
        case GlobOperator.GlobZeroOrMore:
          regex = `(${glob.Pattern!})*`;
          break;
        case GlobOperator.GlobOneOrMore:
          regex = `(${glob.Pattern!})+`;
          break;
        case GlobOperator.GlobOne:
          regex = `(${glob.Pattern!})`;
          break;
        case GlobOperator.GlobExcept:
          regex = `[^${glob.Pattern!}]`;
          break;
        default:
          throw new Error(`never reach`);
      }
      break;
    }
    case 'CmdSubst': { // TODO
      const subst = part as CmdSubst;

      const { readFd, writeFd } = await rosh.execSyscall(SysPipe()) as { readFd: number, writeFd: number };
      const entry: SubcallEntry = { 
        stmts: subst.Stmts.map(stmt => stmt!), 
        dup2: [{ sourceType: 'fd', source: writeFd, target: stdout }] 
      };

      await execSubcallList(ctx, [entry]);
      await rosh.execSyscall(SysClose(writeFd));
      const execResult = await rosh.execSyscall(SysRead(readFd, -1)) as Buffer;
      await rosh.execSyscall(SysClose(readFd));
      return EnvVariable.fromString(execResult.toString().trimEnd());
    }
    case 'ProcSubst': { // TODO
      const subst = part as ProcSubst;
    }
    default:
      throw new Error('never reach');
  }

  // TODO: remove this
  unreachable();
  return EnvVariable.fromString('');
}

export const resolveWord = async (ctx: RoshContext, word: Word): Promise<string> => {
  let wordStr = '';
  word = syntax.SplitBraces(word);
  for (const part of word.Parts) {
    wordStr += (await resolveWordpart(ctx, part)).string;
  }
  return wordStr;
}

export const resolveAssign = async (ctx: RoshContext, assign: Assign): Promise<EnvVariable[]> => {
  const { env, rosh } = ctx;
  const envVar = env.get(assign.Name!.Value);

  if (assign.Naked) {
    if (assign.Name) {
      assert(assign.Value === null);
      envVar.name = assign.Name.Value;
      return [envVar];
    } else {
      const allEnvVar: EnvVariable[] = [];
      const varAssign = await resolveWord(ctx, assign.Value!);
      for (const [name, value] of Object.entries(parseEnvVars(varAssign))) {
        const envVar = env.get(name);
        envVar.string = value;
        envVar.name = name;
        allEnvVar.push(envVar);
      }
      return allEnvVar;
    }
  }

  if (assign.Array) {
    envVar.clear();
    if (envVar.isString()) {
      envVar.toArray();
    }
    let idx = 0;
    for (const elem of assign.Array.Elems) {
      const varAssign = EnvVariable.fromString(await resolveWord(ctx, elem!.Value!));
      const indexExpr = elem!.Index;
      if (indexExpr) {
        if (envVar.isAssociative()) {
          if (syntax.NodeType(indexExpr) === 'Word' && (indexExpr as Word).Parts.length === 1 &&
            (syntax.NodeType(((indexExpr as Word).Parts[0] as WordPart)) === 'SglQuoted') || syntax.NodeType(((indexExpr as Word).Parts[0] as WordPart)) === 'DblQuoted') {
            envVar.associative[await resolveWord(ctx, indexExpr as Word)] = varAssign;
          } else {
            envVar.associative[(await resolveArithmExpr(ctx, indexExpr)).string] = varAssign;
          }
        } else {
          idx = (await resolveArithmExpr(ctx, indexExpr)).number;
          envVar.array[idx++] = varAssign;
        }
      } else {
        if (envVar.isAssociative()) {
          await rosh.execSyscall(SysWriteAll(stderr, Buffer.from(`rosh: ${assign.Name!.Value}: ${varAssign.string}: must use subscript when assigning associative array`)));
        } else {
          envVar.array[idx++] = varAssign;
        }
      }
    }
  }

  if (assign.Value) {
    const varAssign = await resolveWord(ctx, assign.Value);
    if (assign.Index) {
      const index = await resolveArithmExpr(ctx, assign.Index);
      console.log('index', index);
      if (envVar.isString()) {
        assert(index.number >= 0, `rosh: ${assign.Name!.Value}: bad array subscript`);
        if (index.number > 0) {
          envVar.array = createDefaultRecord<number, EnvVariable>(() => EnvVariable.fromString(''), { 0: EnvVariable.from(envVar) });
        }
        envVar.array[index.number].string = varAssign;
      } else if (envVar.isArray()) {
        assert(index.number >= 0, `rosh: ${assign.Name!.Value}: bad array subscript`);
        envVar.array[index.number].string = varAssign;
      } else {
        envVar.associative[index.string].string = varAssign;
      }
    } else {
      envVar.string = varAssign;
    }
  }

  envVar.name = assign.Name!.Value;
  return [envVar];
}

interface Dup2Entry {
  sourceType: 'fd' | 'read' | 'readwrite' | 'overwrite' | 'append' | 'heredoc';
  source: number | string;
  target: number;
}

interface SubcallEntry {
  stmts: Stmt[];
  dup2: Dup2Entry[];
  pipe?: BinCmdOperator.Pipe | BinCmdOperator.PipeAll;
}

const resolveRedirects = async (ctx: RoshContext, redirs: Redirect[]): Promise<Dup2Entry[]> => {
  const { rosh } = ctx;

  const dup2Entries: Dup2Entry[] = [];
  for (const redir of redirs) {
    let hdocStr = redir.Hdoc ? await resolveWord(ctx, redir.Hdoc) : undefined;

    const redirOp = redir.Op as number;
    switch (redirOp) {
      case RedirOperator.DplIn:       // <&
      case RedirOperator.DplOut: {    // >&
        let target = redirOp === RedirOperator.DplIn ? stdin : stdout;
        target = redir.N ? Number(redir.N.Value) : target;
        const sourceWord = await resolveWord(ctx, redir.Word!);
        const source = Number(sourceWord);
        if (!Number.isInteger(source)) {
          await rosh.execSyscall(SysWriteAll(stderr, Buffer.from(`rosh: ${sourceWord}: ambiguous redirect`)));
        }
        dup2Entries.push({ sourceType: 'fd', source, target });
        break;
      }
      case RedirOperator.RdrOut:      // >
      case RedirOperator.ClbOut:      // >|
      case RedirOperator.AppOut: {    // >>
        const target = redir.N ? Number(redir.N.Value) : stdout;
        const source = await resolveWord(ctx, redir.Word!);
        const sourceType = redirOp as number === RedirOperator.AppOut ? 'append' : 'overwrite';
        dup2Entries.push({ sourceType, source, target });
        break;
      }
      case RedirOperator.RdrAll:      // &>
      case RedirOperator.AppAll: {    // &>>
        const sourceType = redirOp as number === RedirOperator.AppAll ? 'append' : 'overwrite';
        const source = await resolveWord(ctx, redir.Word!);
        [stdout, stderr].forEach(target => dup2Entries.push({ sourceType, source, target }));
        break;
      }
      case RedirOperator.RdrInOut:    // <>
      case RedirOperator.RdrIn: {     // <
        const target = redir.N ? Number(redir.N.Value) : stdin;
        const source = await resolveWord(ctx, redir.Word!);
        dup2Entries.push({ sourceType: redirOp === RedirOperator.RdrIn ? 'read' : 'readwrite', source, target });
        break;
      }
      case RedirOperator.DashHdoc:    // <<-
        hdocStr = hdocStr!.split('\n').map(line => line.startsWith('\t') ? line.substring(1) : line).join('\n');
      case RedirOperator.WordHdoc:    // <<<
        hdocStr ??= await resolveWord(ctx, redir.Word!);
      case RedirOperator.Hdoc:        // <<
        dup2Entries.push({ sourceType: 'heredoc', source: hdocStr!, target: stdin });
        break;
      default:
        throw new Error('never reach');
    }
  }

  return dup2Entries;
}

const isPipeCommand = (command: Command) => {
  return syntax.NodeType(command) === 'BinaryCmd' && 
    ((command as BinaryCmd).Op as number === BinCmdOperator.Pipe || 
    (command as BinaryCmd).Op as number === BinCmdOperator.PipeAll);
}

const buildSubcallEntry = async (ctx: RoshContext, stmt: Stmt): Promise<SubcallEntry> => {
  return {
    stmts: [stmt],
    dup2: await resolveRedirects(ctx, stmt.Redirs.map(redir => redir!))
  }
}

const flattenPipeCommands = async (ctx: RoshContext, command: BinaryCmd): Promise<SubcallEntry[]> => {
  const entries: SubcallEntry[][] = [];
  for (const stmt of [command.X!, command.Y!]) {
    entries.push(isPipeCommand(stmt.Cmd) ? await flattenPipeCommands(ctx, stmt.Cmd as BinaryCmd) : [await buildSubcallEntry(ctx, stmt)]);
  }

  entries[0].at(-1)!.pipe = command.Op as any;
  return [...entries[0], ...entries[1]];
}

export const execCommand = async (ctx: RoshContext, cmd: Command, dup2?: Dup2Entry[]): Promise<number> => {
  let retCode: number;
  const { env, rosh } = ctx;
  switch (syntax.NodeType(cmd)) {
    case 'CallExpr': {
      const expr = cmd as CallExpr;
      let toRestore: Record<string, EnvVariable> = {};
      if (expr.Args.length > 0) {
        for (const assign of expr.Assigns) {
          const name = assign!.Name!.Value;
          toRestore[name] = EnvVariable.from(env.get(name));
        }
      }

      const words: string[] = [];
      for (const arg of expr.Args) {
        words.push(await resolveWord(ctx, arg!));
      }
      console.log('callexpr:',words);

      const envRecord = await rosh.execSyscall(SysEnvironment()) as Record<string, string>;
      for (const assign of expr.Assigns) {
        for (const assignVar of await resolveAssign(ctx, assign!)) {
          envRecord[assignVar.name] = assignVar.string;
        }
      }

      if (words.length > 0) {
        const command = words[0]!;
        const args = words.slice(1);
        retCode = await execCall(ctx, command, args, dup2 ?? [], envRecord);
        console.log('return', retCode);
      } else {
        retCode = 0;
      }

      for (const name in toRestore) {
        env.set(name, toRestore[name]);
      }

      break;
    }
    case 'IfClause': {
      const clause = cmd as IfClause;
      for (const condStmt of clause.Cond) {
        await execStmt(ctx, condStmt!, true);
      }

      console.log('if !!', env.get('?'))

      if (env.get('?').number === 0 || clause.Cond.length === 0) {
        for (const thenStmt of clause.Then) {
          await execStmt(ctx, thenStmt!, true);
        }

        console.log('if then!!');
        retCode = env.get('?').number; // TODO
      } else if (clause.Else) {
        console.log('if else!!');
        retCode = await execCommand(ctx, clause.Else);
      } else {
        console.log('if nothing!!');
        retCode = 0;
      }

      break;
    }
    case 'WhileClause': {
      const clause = cmd as WhileClause;
      while (true) {
        for (const condStmt of clause.Cond) {
          await execStmt(ctx, condStmt!, true);
        }
        
        retCode = env.get('?').number;
        console.log('retCode', retCode);
        if (retCode !== 0) {
          break;
        }

        for (const doStmt of clause.Do) {
          await execStmt(ctx, doStmt!, true);
        }
      }
      retCode = env.get('?').number;
      break;
    }
    case 'ForClause': {
      const clause = cmd as ForClause;
      const execDo = async () => {
        for (const doStmt of clause.Do) {
          await execStmt(ctx, doStmt!, true);
        }
      }

      if (syntax.NodeType(clause.Loop) === 'WordIter') {
        const loop = clause.Loop as WordIter;
        const iterVar = env.get(loop.Name!.Value);
        for (const item of loop.Items) {
          const itemVal = await resolveWord(ctx, item!);
          iterVar.string = itemVal;
          await execDo();
        }
      } else if (syntax.NodeType(clause.Loop) === 'CStyleLoop') {
        const loop = clause.Loop as CStyleLoop;
        for (await resolveArithmExpr(ctx, loop.Init); (await resolveArithmExpr(ctx, loop.Cond)).number; await resolveArithmExpr(ctx, loop.Post)) {
          await execDo();
        }
      }

      retCode = env.get('?').number;
      break;
    }
    case 'CaseClause': {
      const clause = cmd as CaseClause;
      const wordStr = await resolveWord(ctx, clause.Word!);
      
      retCode = 0;
      let checkPattern = true;
      for (const item of clause.Items) {
        if (checkPattern) {
          let pass = false;
          for (const pattern of item!.Patterns) {
            const regex = caseWildcard2Regex(await resolveWord(ctx, pattern!));
            if (regex.test(wordStr)) {
              pass = true;
              break;
            }
          }

          if (!pass) {
            checkPattern = true;
            continue;
          }
        }

        for (const caseStmt of item!.Stmts) {
          await execStmt(ctx, caseStmt!, true);
        }

        retCode = env.get('?').number;

        switch (item!.Op as number) {
          case CaseOperator.Break:        // ;;
            break;
          case CaseOperator.Fallthrough:  // ;&
            checkPattern = false;
            continue;
          case CaseOperator.Resume:       // ;;&
            checkPattern = true;
            continue;
          default:
            throw new Error('never reach')
        }
        break;
      }
      break;
    }
    case 'Block': {
      const block = cmd as Block;
      for (const blockStmt of block.Stmts) {
        await execStmt(ctx, blockStmt!, true);
      }
      retCode = env.get('?').number;
      break;
    }
    case 'BinaryCmd': {
      const binCmd = cmd as BinaryCmd;
      switch (binCmd.Op as number) {
        case BinCmdOperator.AndStmt:
          await execStmt(ctx, binCmd.X!, true);
          if (env.get('?').number === 0) {
            await execStmt(ctx, binCmd.Y!, true);
          }
          retCode = env.get('?').number;
          break;
        case BinCmdOperator.OrStmt:
          await execStmt(ctx, binCmd.X!, true);
          if (env.get('?').number !== 0) {
            await execStmt(ctx, binCmd.Y!, true);
          }
          retCode = env.get('?').number;
          break;
        case BinCmdOperator.Pipe:
        case BinCmdOperator.PipeAll: {
          const callList = await flattenPipeCommands(ctx, binCmd);
          retCode = await execSubcallList(ctx, callList);
          console.log('return done!!!', retCode);
          break;
        }
          
        default:
          throw new Error('never reach');
      }
      break;
    }
    case 'FuncDecl':
      retCode = -1;
      await rosh.execSyscall(SysWriteAll(stderr, Buffer.from('Function is not supported yet\r\n')));
      break;
    case 'ArithmCmd': {
      const arithm = cmd as ArithmCmd;
      const resVar = await resolveArithmExpr(ctx, arithm.X);
      retCode = +(resVar!.number === 0);
      break;
    }
    case 'DeclClause': {
      const clause = cmd as DeclClause;
      switch (clause.Variant!.Value) {
        case 'typeset':
        case 'declare':
          break; // TODO
        case 'local':
          break; // TODO
        case 'export':
          for (const assign of clause.Args) {
            const allEnvVar = await resolveAssign(ctx, assign!);
            for (const envVar of allEnvVar) {
              envVar.setSysEnv();
              await rosh.execSyscall(SysSetenv(envVar.name, envVar.string, true));
            }
          }
          retCode = 0;
          break;
        case 'readonly':
          for (const assign of clause.Args) {
            const allEnvVar = await resolveAssign(ctx, assign!);
            for (const envVar of allEnvVar) {
              envVar.setReadonly();
            }
          }
          retCode = 0;
          break;
        case 'nameref':
          break; // TODO
        default:
          throw new Error('never reach');
      }
      break;
    }
    case 'LetClause': {
      const clause = cmd as LetClause;
      let resVar: EnvVariable;
      for (const expr of clause.Exprs) {
        resVar = await resolveArithmExpr(ctx, expr);
      }

      retCode = +(resVar!.number === 0);
      break;
    }
    case 'Subshell': {
      const subshell = cmd as Subshell;
      const entry: SubcallEntry = { 
        stmts: subshell.Stmts.map(stmt => stmt!), 
        dup2: []
      };

      retCode = await execSubcallList(ctx, [entry]);
      break;
    }
    case 'TimeClause':
      retCode = -1;
      await rosh.execSyscall(SysWriteAll(stderr, Buffer.from('time is not supported yet\r\n')));
      break;
    case 'CoprocClause':
      retCode = -1;
      await rosh.execSyscall(SysWriteAll(stderr, Buffer.from('coproc is not supported yet\r\n')));
      break;
    case 'TestDecl':
    case 'TestClause':
    default:
      throw new Error(`${syntax.NodeType(cmd)} never reach`);
  }

  // TODO: remove this
  // @ts-ignore
  return retCode;
}

export const execStmt = async (ctx: RoshContext, stmt: Stmt, innerCall: boolean = false): Promise<void> => {
  const { env, rosh } = ctx;
  try {
    syntax.DebugPrint(stmt);
    const retCode = await execCommand(ctx, stmt.Cmd, await resolveRedirects(ctx, stmt.Redirs.map(redir => redir!)));
    env.set('?', EnvVariable.fromNumber(retCode));

    console.log('command done!!', retCode, innerCall);

    if (!innerCall) {
      await rosh.execReturns(retCode);
    }
    console.log('command done11!!', retCode, innerCall);
  } catch (err: unknown) {
    console.log('command err!!', err, innerCall, ctx.rosh);
    if (!innerCall) {
      await rosh.execReturns(err as Error);
    } else {
      throw err;
    }
  }
}

const execFunc = async (ctx: RoshContext, command: string, args: string[], dup2: Dup2Entry[], envRecord?: Record<string, string>): Promise<number | undefined> => {
  return undefined;
}

const execBuiltin = async (ctx: RoshContext, command: string, args: string[], dup2: Dup2Entry[], envRecord?: Record<string, string>): Promise<number | undefined> => {
  const { rosh, env } = ctx;
  let retCode: number | undefined;
  console.log('execBuiltin:', command, args);
  switch (command) {
    case 'test': {
      const { readFd, writeFd } = await rosh.execSyscall(SysPipe()) as { readFd: number, writeFd: number };
      await rosh.execSyscall(SysWriteAll(writeFd, Buffer.from('hello')));
      await rosh.execSyscall(SysClose(writeFd));
      const readStr = await rosh.execSyscall(SysRead(readFd, -1)) as Buffer;
      console.log('test!!!', readStr.toString())
      await rosh.execSyscall(SysWriteAll(stdout, Buffer.from(readStr.toString())));
      retCode = 0;
      break;
    }
    case 'cd':
      retCode = +(!await rosh.execSyscall(SysChdir(args[0])) as boolean);
      rosh.cwd = await rosh.execSyscall(SysGetcwd()) as string;
      break;
    case '[':
      retCode = evalBracketCommand(args);
      break;
    case 'exec':
      const [nonPipeRedirs, fdsToClose] = await resolveDup2(ctx, dup2);
      for await (const syscall of execRedirs(nonPipeRedirs)) {
        await rosh.execSyscall(syscall);
      }

      if (args.length > 0) {
        retCode = (await rosh.execSyscall(SysExecvpe(args[0], args.slice(1)))) as number;
        await rosh.execSyscall(SysWriteAll(stderr, Buffer.from(chalk.redBright(`exec: ${args[0]}: not found\r\n`))));
      } else {
        retCode = 0;
      }

      console.log('!!exec', rosh);
      
      for (const fd of fdsToClose) {
        await rosh.execSyscall(SysClose(fd));
      }
      break;
    case 'exit':
      if (args.length > 1) {
        await rosh.execSyscall(SysWriteAll(stderr, Buffer.from(chalk.redBright(`${command}: too many arguments\r\n`))));
        retCode = 1;
      } else {
        const exitCode = args.length > 0 ? Number(args[0]) : 1;
        await rosh.execExit(exitCode);
        retCode = 0;
      }
      break;
  }

  return retCode;
}

type RedirEntry = [number | [string, OpenFlags], number];

const execRedirs = async function *(redirs: RedirEntry[]): Entrypoint {
  for (let [oldFd, newFd] of redirs) {
    if (typeof oldFd !== 'number') {
      oldFd = (yield SysOpen(oldFd[0], oldFd[1])) as number;
    }
    yield SysDup2(oldFd, newFd);
    if (oldFd > stderr) {
      yield SysClose(oldFd);
    }
  }

  return 0;
}

const resolveDup2 = async (ctx: RoshContext, dup2: Dup2Entry[]): Promise<[RedirEntry[], number[]]> => {
  const { rosh } = ctx;
  const redirs: RedirEntry[] = [];
  const toClose: number[] = [];
  for (const entry of dup2) {
    switch (entry.sourceType) {
      case "fd":
        assert(typeof entry.source === 'number');
        redirs.push([entry.source, entry.target]);
        break;
      case "read":
        assert(typeof entry.source === 'string');
        redirs.push([[entry.source, OpenFlags.CREAT | OpenFlags.READ], entry.target]);
        break;
      case "readwrite":
        assert(typeof entry.source === 'string');
        redirs.push([[entry.source, OpenFlags.CREAT | OpenFlags.READ | OpenFlags.WRITE], entry.target]);
        break;
      case "overwrite":
        assert(typeof entry.source === 'string');
        redirs.push([[entry.source, OpenFlags.CREAT | OpenFlags.WRITE | OpenFlags.TRUNC], entry.target]);
        break;
      case "append":
        assert(typeof entry.source === 'string');
        redirs.push([[entry.source, OpenFlags.CREAT | OpenFlags.WRITE | OpenFlags.APPEND], entry.target]);
        break;
      case "heredoc": {
        console.log('heredoc!!', entry);
        assert(typeof entry.source === 'string');
        const { readFd, writeFd } = await rosh.execSyscall(SysPipe()) as { readFd: number, writeFd: number };
        redirs.push([readFd, entry.target]);
        await rosh.execSyscall(SysWriteAll(writeFd, Buffer.from(entry.source)));
        await rosh.execSyscall(SysClose(writeFd));
        toClose.push(readFd);
        break;
      }
      default:
        throw new Error('never reach');
    }
  }

  return [redirs, toClose];
}

class SubCommand extends Process {
  private redirs_: RedirEntry[];
  private command_: string;
  private args_: any[];
  private envRecord_?: Record<string, string>;

  constructor(redirs: RedirEntry[], command: string, args: any[], envRecord?: Record<string, string>) {
    super();
    this.redirs_ = redirs;
    this.command_ = command;
    this.args_ = args;
    this.envRecord_ = envRecord;
  }

  async *run(): Entrypoint {
    yield *execRedirs(this.redirs_);
    const retCode = (yield SysExecvpe(this.command_, this.args_, this.envRecord_)) as number;

    if (retCode === 1) {
      yield SysWriteAll(stderr, Buffer.from(chalk.redBright(`${this.command_}: command not found\r\n`)));
    }

    return retCode;
  }
}

const execExternal = async (ctx: RoshContext, command: string, args: string[], dup2: Dup2Entry[], envRecord?: Record<string, string>): Promise<number | undefined> => {
  let retCode: number;
  const { rosh } = ctx;

  const [nonPipeRedirs, fdsToClose] = await resolveDup2(ctx, dup2);

  const pid = await rosh.execSyscall(SysSpawn(SubCommand, nonPipeRedirs, command, args, envRecord)) as number;

  for (const fd of fdsToClose) {
    await rosh.execSyscall(SysClose(fd));
  }

  ({ retCode } = await rosh.execSyscall(SysWaitpid(pid)) as { pid: number, retCode: number });
  console.log('execExternal:', command, args, pid, retCode);

  return retCode;
}

const execCall = async (ctx: RoshContext, command: string, args: string[], dup2: Dup2Entry[], envRecord?: Record<string, string>): Promise<number> => {
  let retCode: number | undefined;
  retCode ??= await execFunc(ctx, command, args, dup2, envRecord);
  retCode ??= await execBuiltin(ctx, command, args, dup2, envRecord);
  retCode ??= await execExternal(ctx, command, args, dup2, envRecord);
  return retCode!;
}

class SubshellProc extends Process {
  private parentRosh_: Rosh;
  private redirs_: RedirEntry[];
  private args_: any[];
  constructor(parentRosh: Rosh, redirs: RedirEntry[], ...args: any[]) {
    super();
    this.parentRosh_ = parentRosh;
    this.redirs_ = redirs;
    this.args_ = args;
  }

  async *run(): Entrypoint {
    yield *execRedirs(this.redirs_);

    const rosh = new Rosh(...this.args_);
    rosh.env = shallowCopy(this.parentRosh_.env);

    console.log('!!!da!!', this.redirs_, this.fdtable.map(h => shallowCopy(h)));

    yield SysExec(rosh);
    return -1;
  }
}

const execSubcallList = async (ctx: RoshContext, callList: SubcallEntry[]): Promise<number> => {
  const { rosh } = ctx;

  const allFds: number[] = [];
  const allPids: number[] = [];
  let redirs: RedirEntry[] = [];
  console.log('!!!calllist', callList);
  for (let i = 0; i < callList.length; i++) {
    const { stmts, dup2, pipe } = callList[i];

    let readFd: number | undefined, writeFd: number | undefined;

    if (i < callList.length - 1) {
      ({ readFd, writeFd } = await rosh.execSyscall(SysPipe()) as { readFd: number, writeFd: number });
      redirs.push([writeFd, stdout]);
      if (pipe === BinCmdOperator.PipeAll) {
        redirs.push([writeFd, stderr]);
      }
      allFds.push(readFd);
    }

    const [nonPipeRedirs, fdToClose] = await resolveDup2(ctx, dup2);
    redirs.push(...nonPipeRedirs);
    allFds.push(...fdToClose);

    const pid = await rosh.execSyscall(SysSpawn(SubshellProc, rosh, redirs, stmts)) as number;
    allPids.push(pid);
    writeFd && await rosh.execSyscall(SysClose(writeFd));
    readFd && (redirs = [[readFd, stdin]]);
  }

  for (const fd of allFds) {
    await rosh.execSyscall(SysClose(fd));
  }

  let retCode = 0;
  for (const pid of allPids) {
    ({ retCode } = await rosh.execSyscall(SysWaitpid(pid)) as { pid: number, retCode: number });
  }

  return retCode;
}
