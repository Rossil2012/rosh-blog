import { FileHandle, Kernel, assert, closeImpl, shallowCopy } from "../internal";
import { Buffer } from "buffer";

export type FdTable = Array<FileHandle | null>;
export type RetCode = number | typeof Process.RETCODE.KILLED;
export type Entrypoint = AsyncGenerator<Syscall, number, unknown>;

export abstract class Process {
  static STATE = {
    RUNNING: Symbol('RUNNING'),
    READY: Symbol('READY'),
    BLOCKED: Symbol('BLOCKED'),
    STOPPED: Symbol('STOPPED'),
    ZOMBIE: Symbol('ZOMBIE')
  }

  static RETCODE = {
    KILLED: Symbol('KILLED')
  }

  kernel!: Kernel;
  pid!: number;
  pgid!: number;
  parentPid!: number;
  state!: Symbol;
  fdtable!: FdTable;
  buf!: (Buffer | null)[];
  gen: AsyncGenerator<Syscall, number, unknown>;
  uid!: number;
  gid!: number[];
  umask!: number;
  env!: Record<string, string>;
  cwd!: string;
  retCode: number | undefined;

  private pendingWaits_: ((retCode: number) => void)[];

  constructor(...args: any[]) {
    this.gen = this.run(...args);
    this.pendingWaits_ = [];
  }

  async return(retCode: number) {
    console.log('return1!!!', shallowCopy(this.fdtable), this);
    for (let fd = 0; fd < this.fdtable.length; fd++) {
      if (this.fdtable[fd]) {
        await closeImpl({ proc: this }, fd);
      }
    }
    console.log('return2!!!', shallowCopy(this.fdtable), this);

    this.retCode = retCode;
    this.state = Process.STATE.ZOMBIE;
    while (this.pendingWaits_.length > 0) {
      const resolve = this.pendingWaits_.shift()!;
      resolve(retCode);
    }
  }

  async wait(): Promise<number> {
    if (this.state === Process.STATE.ZOMBIE) {
      return this.retCode!;
    }

    return new Promise<number>(resolve => {
      this.pendingWaits_.push(resolve);
    });
  }

  abstract run(...args: any[]): Entrypoint;
}

export interface Syscall {
  exec(ctx: ProcessContext): Promise<unknown>;
}

export type ProcessContext = {
  proc: Process;
};

export type AsyncFunction = (...args: any[]) => Promise<any>;

export class FcnSyscall implements Syscall {
  private fcn_: AsyncFunction;
  private args_: any[];
  constructor(fcn: AsyncFunction, ...args: any[]) {
    this.fcn_ = fcn;
    this.args_ = args;
  }

  async exec(ctx: ProcessContext): Promise<unknown> {
    return this.fcn_(ctx, ...this.args_);
  }
}
