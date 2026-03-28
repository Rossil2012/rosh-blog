import { stdin, stdout, stderr, openImpl, readImpl, dup2Impl, closeImpl, FcnSyscall, assert,
  ProcessContext, Process, Kernel, Inode, OpenFlags, Syscall, Entrypoint, Mode, BinFile, shallowCopy, getAbsPath, InodeWrapper, isFileWrapper, 
  getVfsFromCtx} from "../../internal";
import { Buffer } from "buffer";

type ProcessBuilder = new (...args: any[]) => Process;
export type Executable = ProcessBuilder;

const makeContext = (proc: Process): ProcessContext => {
  return { proc };
}

const makeProcess = (ctx: ProcessContext, procT: ProcessBuilder | Process, env?: Record<string, string>, ...args: any[]): Process => {
  const proc = procT instanceof Process ? procT : new procT(...args);
  proc.pgid = ctx.proc.pgid;
  proc.parentPid = ctx.proc.pid;
  proc.uid = ctx.proc.uid;
  proc.gid = ctx.proc.gid;
  proc.fdtable = Array.from(ctx.proc.fdtable);
  proc.buf = Array(ctx.proc.buf.length).fill(null);
  proc.env = env ?? shallowCopy(ctx.proc.env);
  proc.cwd = ctx.proc.cwd;
  proc.kernel = ctx.proc.kernel;

  for (let i = 0; i < ctx.proc.fdtable.length; i++) {
    const handle = proc.fdtable[i];
    if (handle) {
      handle.count++;
      proc.buf[i] = Buffer.alloc(0);
    }
  }

  return proc;
}

export const spawnImpl = async (ctx: ProcessContext, procT: ProcessBuilder | Process, ...args: any[]): Promise<number> => {
  const kernel = ctx.proc.kernel;

  return kernel.createProcess(makeProcess(ctx, procT, undefined, ...args));
}

export const SysSpawn = (procT: ProcessBuilder | Process, ...args: any[]) => {
  return new FcnSyscall(spawnImpl, procT, ...args);
}

// class ProcessWithInit extends Process {
//   private init_: Entrypoint[];
//   private proc_: Entrypoint;

//   constructor(procT: ProcessBuilder, init: Entrypoint[], ...args: any[]) {
//     super();
//     this.init_ = init;
//     this.proc_ = (new procT(...args)).gen;
//   }

//   async *run(): Entrypoint {
//     for (const gen of this.init_) {
//       yield *gen;
//     }

//     let result: unknown;
//     while (true) {
//       let { value, done } = await this.proc_.next(result);
//       if (done) {
//         return value as number;
//       }
//       result = yield (value as Syscall);
//     }
//   }
// }

// export const forkImpl = async (ctx: ProcessContext, procT: ProcessBuilder, init: Entrypoint[], ...args: any[]): Promise<number> => {
//   return spawnImpl(ctx, ProcessWithInit, procT, init, ...args);
// }

// export const SysFork = async (procT: ProcessBuilder, init: Entrypoint[], ...args: any[]) => {
//   return new FcnSyscall(forkImpl, procT, init, ...args);
// }

export const spawnPtyImpl = async (ctx: ProcessContext, procT: ProcessBuilder, ...args: any[]): Promise<{ pid: number, ptmxFd: number }> => {
  const kernel = ctx.proc.kernel;
  const ptmxFd = await openImpl(ctx, '/dev/ptmx', OpenFlags.READ | OpenFlags.WRITE);
  const ptsPath = `/dev/pts/${(await readImpl(ctx, ptmxFd, 4)).readUInt32LE(0)}`;

  const childProc = makeProcess(ctx, procT, undefined, ...args);
  const childCtx = makeContext(childProc);
  const readablePts = await openImpl(childCtx, ptsPath, OpenFlags.READ);
  const writablePts = await openImpl(childCtx, ptsPath, OpenFlags.WRITE);

  await dup2Impl(childCtx, readablePts, stdin);
  await dup2Impl(childCtx, writablePts, stdout);
  await dup2Impl(childCtx, writablePts, stderr);
  await closeImpl(childCtx, ptmxFd);
  await closeImpl(childCtx, readablePts);
  await closeImpl(childCtx, writablePts);

  const pid = await kernel.createProcess(childProc);

  return { pid, ptmxFd };
}

export const SysSpawnPty = (procT: ProcessBuilder, ...args: any[]) => {
  return new FcnSyscall(spawnPtyImpl, procT, ...args);
}

const lookupExecutable = async (ctx: ProcessContext, path: string): Promise<Executable | undefined> => {
  const envPath = ctx.proc.env['PATH'] ?? '';
  const allAbsPath = getAbsPath(path, ctx.proc.cwd, envPath);
  let inode: InodeWrapper | undefined;
  let abspath: string;
  const vfs = getVfsFromCtx(ctx);
  for (abspath of allAbsPath) {
    try {
      inode = await vfs.inode(ctx, abspath);
    } catch (_) {
      continue;
    }
    break;
  }

  if (inode) {
    const pass = await inode.permission(ctx, ctx.proc.uid, ctx.proc.gid, Mode.EXEC);
    if (pass && inode.impl instanceof BinFile) {
      const handle = await vfs.open(ctx, abspath!, OpenFlags.READ);
      assert(isFileWrapper(inode));
      await inode.read(ctx, handle, -1, 0);
      handle.count = 0;
      await vfs.release(ctx, handle);
      return inode.impl.getExecutable();
    }
  }

  return undefined;
}

export const spawnvpeImpl = async (ctx: ProcessContext, path: string, args: any[], env?: Record<string, string>): Promise<number> => {
  const kernel = ctx.proc.kernel;
  const executable = await lookupExecutable(ctx, path);

  if (executable) {
    return kernel.createProcess(makeProcess(ctx, executable, env, ...args));
  }

  return -1;
}

export const SysSpawnvpe = (path: string, args: any[], env?: Record<string, string>) => {
  return new FcnSyscall(spawnvpeImpl, path, args, env);
}

export const execImpl = async (ctx: ProcessContext, procT: ProcessBuilder | Process, ...args: []): Promise<void> => {
  ctx.proc.gen = procT instanceof Process ? procT.gen : (new procT()).run(...args);
}

export const SysExec = (procT: ProcessBuilder | Process, ...args: any[]) => {
  return new FcnSyscall(execImpl, procT, ...args);
}

export const execvpeImpl = async (ctx: ProcessContext, path: string, args: any[], env?: Record<string, string>): Promise<number | undefined> => {
  const executable = await lookupExecutable(ctx, path);

  if (!executable) {
    return 1;
  }

  ctx.proc.gen = (new executable()).run(...args);
  env && (ctx.proc.env = shallowCopy(env));
}

export const SysExecvpe = (path: string, args: any[], env?: Record<string, string>) => {
  return new FcnSyscall(execvpeImpl, path, args, env);
}

export const waitpidImpl = async (ctx: ProcessContext, pid: number, options: number): Promise<{ pid: number, retCode: number } | undefined> => {
  const { proc } = ctx;
  const kernel = ctx.proc.kernel;
  const allProms: Promise<{ pid: number, retCode: number }>[] = [];
  let procGroup: Set<number> | undefined;

  if (pid > 0) {
    procGroup = new Set([pid]);
  } else if (pid === 0) {
    procGroup = kernel.getProcessGroup(proc.pgid)!;
  } else if (pid < 0) {
    procGroup = kernel.getProcessGroup(-pid);
  }

  if (!procGroup) {
    return Promise.resolve({ pid: 0, retCode: 0 });
  }

  for (const subPid of procGroup) {
    const subProc = kernel.getProcess(subPid);
    if (subProc && subProc.parentPid === proc.pid) {
      allProms.push(subProc.wait().then(retCode => {
        kernel.removeProcess(subProc.pid);
        return { pid: subProc.pid, retCode };
      }));
    }
  }

  if (allProms.length === 0) {
    return Promise.resolve({ pid: 0, retCode: 0 });
  }

  console.log('waitpid', allProms, ctx.proc);

  return Promise.any(allProms);
}

export const SysWaitpid = (pid: number, options: number = 0) => {
  return new FcnSyscall(waitpidImpl, pid, options);
}
