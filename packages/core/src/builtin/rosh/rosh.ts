import { Term } from './term';
import { Environment, EnvVariable } from './env';
import { getUTF8String, Chan, Process, stdin, stdout, stderr, SysRead, Syscall, SysWriteAll, assert, makeSequence, Entrypoint, SysClose, SysDup2, SysSpawn, SysSpawnvpe, SysOpen, OpenFlags } from '../../internal';
import { Buffer } from "buffer";
import chalk from 'chalk';
import { execStmt } from './runner';
import { Stmt } from 'mvdan-sh';

const CHUNK_SIZE = 16;

type keyMap = {[key: string]: string | keyMap};

const keyMap: keyMap = {
  '\x1b': {
    '\x1b[A': 'arrow_up',
    '\x1b[B': 'arrow_down',
    '\x1b[C': 'arrow_right',
    '\x1b[D': 'arrow_left'
  },
  '\x7f': 'backspace'
}

const findInKeyMap = (keyMap: keyMap, input: string): { key: string, token: string } | undefined => {
  for (const key in keyMap) {
    if (input.startsWith(key)) {
      const token = keyMap[key];
      if (typeof token === 'string') {
        return { key, token };
      } else {
        return findInKeyMap(token, input);
      }
    } else if (key.startsWith(input)) { // incomplete input
      return { key: input, token: 'incomplete' }
    }
  }

  return undefined;
}

function *iterateByKey(input: string): Generator<{ key: string, token: string }> {
  let remainingInput = input;

  while (remainingInput.length > 0) {
    let foundSequence = findInKeyMap(keyMap, remainingInput);

    if (!foundSequence) {
      yield { key: remainingInput[0], token: remainingInput[0] };
      remainingInput = remainingInput.slice(1);
    } else {
      yield foundSequence;
      remainingInput = remainingInput.slice(foundSequence.key.length);
    }
  }
}

export interface RoshContext {
  env: Environment;
  rosh: Rosh;
}

export const exitSymbol = Symbol('Exit');

const initScripts = ['/etc/profile'];

export class Rosh extends Process {
  cwd: string;
  username: string;
  private buffer_: Buffer;
  private term_: Term;
  private ctx_: RoshContext;
  private execYields_: Chan<Syscall | number | Error | symbol>;
  private yieldResults_: Chan<unknown>;

  constructor(...args: any[]) {
    super(...args);
    this.buffer_ = Buffer.alloc(0);
    this.term_ = new Term();
    this.ctx_ = { env: new Environment(), rosh: this };
    this.execYields_ = new Chan();
    this.yieldResults_ = new Chan();
    this.cwd = '/';
    this.username= 'rosh';
  }

  async execSyscall(syscall: Syscall): Promise<unknown> {
    await this.execYields_.put(syscall);
    return await this.yieldResults_.get();
  }

  async execExit(exitCode: number): Promise<void> {
    await this.execYields_.put(exitSymbol);
    await this.execYields_.put(exitCode);
  }

  async execReturns(result: number | Error): Promise<void> {
    await this.execYields_.put(result);
    await this.yieldResults_.get();
    this.execYields_.close();
    this.yieldResults_.close();
    this.execYields_ = new Chan();
    this.yieldResults_ = new Chan();
  }

  get prompt(): string {
    return `${this.username}@Rossils-blog:${this.cwd}$ `;
  }

  private putNewData_(newData: Buffer): string {
    this.buffer_ = Buffer.concat([this.buffer_, newData]);

    let { parsedStr, newBuffer } = getUTF8String(this.buffer_);
    this.buffer_ = newBuffer;
    
    return parsedStr;
  }

  private async *execStmts_(stmts: Stmt[]): AsyncGenerator<Syscall, number | undefined, unknown> {
    for (const stmt of stmts) {
      console.log(stmt);
      const execProm = execStmt(this.ctx_, stmt);
      while (true) {
        const toYield = await this.execYields_.get();
        console.log('rosh syscall', toYield);
        if (toYield instanceof Error) {
          yield SysWriteAll(stdout, Buffer.from(chalk.redBright(toYield.message + '\r\n')));
          this.yieldResults_.put(null);
          break;
        } else if (toYield === exitSymbol) {
          const exitCode = await this.execYields_.get() as number;
          return exitCode;
        } else if (typeof toYield === 'number') {
          this.yieldResults_.put(null);
          break;
        } else if (typeof toYield === 'symbol') {
          assert(0);
          break;
        } else {
          await this.yieldResults_.put(yield toYield);
        }
      }
      await execProm;
    }
  }

  private async *execString_(content: string): AsyncGenerator<Syscall, number | undefined, unknown> {
    const stmts = this.term_.parseFile(content);
    return yield *this.execStmts_(stmts);
  }

  async *run(...args: any[]): Entrypoint {
    let newData: Buffer;

    this.term_.init(this.prompt);

    if (args.length > 0) {
      if (typeof args[0] === 'string') {
        // TODO: exec script
      } else {
        const exitCode = yield *this.execStmts_(args[0] as Stmt[]);
        console.log('!!!!!!', args, exitCode);
        return exitCode ?? 0;
      }
    }

    for (const script of initScripts) {
      const fd = (yield SysOpen(script, OpenFlags.READ)) as number;
      const content = (yield SysRead(fd, -1)) as string;
      const exitCode = yield *this.execString_(content);
      if (exitCode) {
        return exitCode;
      }
      yield SysClose(fd);
    }

    yield SysWriteAll(stdout, this.term_.getPromt());

    while ((newData = <Buffer>(yield SysRead(stdin, CHUNK_SIZE)))) {
      if (newData instanceof Error) {
        return -1;
      } else if (newData.length === 0) {
        break;
      }

      const parsedStr = this.putNewData_(newData);

      if (parsedStr.length === 0) {
        continue;
      }

      for (const { key, token } of iterateByKey(parsedStr)) {
        switch (token) {
          case 'incomplete':
            this.buffer_ = Buffer.concat([Buffer.from(key), this.buffer_]);
            break;
          case 'backspace':
            yield SysWriteAll(stdout, this.term_.backspace());
            break;
          case '\n': {
            const { complete, writeBeforeExec, statements } = this.term_.enter();
            yield SysWriteAll(stdout, writeBeforeExec);
            if (complete) {
              const exitCode = yield *this.execStmts_(statements);
              if (exitCode) {
                return exitCode;
              }

              this.term_.setPrompt(this.prompt);
              yield SysWriteAll(stdout, this.term_.newCommand());
            }
            break;
          }
          case 'arrow_up': 
          case 'arrow_down':
            yield SysWriteAll(stdout, this.term_.arrowY(token === 'arrow_up' ? -1 : 1));
            break;
          case 'arrow_right':
          case 'arrow_left':
            yield SysWriteAll(stdout, this.term_.arrowX(token === 'arrow_right' ? 1 : -1));
            break;
          default:
            yield SysWriteAll(stdout, this.term_.write(key));
            break;
        }
      }
    }

    console.log('rosh exit!!!', newData);

    return 0;
  }
}