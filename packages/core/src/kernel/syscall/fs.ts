import { FcnSyscall, ProcessContext, OpenFlags, FileHandle, PollFlag, assert, sleep, 
  findOrPushNullEntry, Process, StreamFile, BinFile, Executable, StatInfo, Inode, Stream, Kernel, shallowCopy, getAbsPath, 
  VFS} from "../../internal";
import { Buffer } from "buffer";

export const stdin = 0;
export const stdout = 1;
export const stderr = 2;

const CHUNK_SIZE = 64;

const checkFd = (ctx: ProcessContext, fd: number): boolean => {
  return fd >= 0 && fd < ctx.proc.fdtable.length && ctx.proc.fdtable[fd] !== null && ctx.proc.buf[fd] !== null;
}

const checkFlags = (flags: number, ...toCheck: number[]): boolean => {
  for (const flag of toCheck) {
    if (!(flag & flags)) {
      return false;
    }
  }
  return true;
}

const getHandle = (ctx: ProcessContext, fd: number): FileHandle => {
  return ctx.proc.fdtable[fd]!;
}

export const getVfsFromCtx = (ctx: ProcessContext): VFS => {
  return ctx.proc.kernel.getVfs();
}

const allocFd = (proc: Process, handle?: FileHandle): number => {
  const fd = findOrPushNullEntry(proc.fdtable);
  assert(fd === findOrPushNullEntry(proc.buf));
  if (handle) {
    proc.fdtable[fd] = handle;
    proc.buf[fd] = Buffer.alloc(0);
  }
  return fd;
}

export const openImpl = async (ctx: ProcessContext, path: string, flags: number) => {
  const { proc } = ctx;
  const vfs = getVfsFromCtx(ctx);
  const handle = await vfs.open(ctx, path.startsWith('/') ? path : `${proc.cwd}/${path}`, flags);
  const fd = allocFd(proc, handle);
  return fd;
}

export const SysOpen = (path: string, flags: number) => {
  return new FcnSyscall(openImpl, path, flags);
}

export const closeImpl = async (ctx: ProcessContext, fd: number) => {
  const { proc } = ctx;
  const vfs = getVfsFromCtx(ctx);
  assert(checkFd(ctx, fd), 'close: illegal file descriptor.');

  const handle = getHandle(ctx, fd);
  if (--handle.count <= 0) {
    await vfs.release(ctx, handle);
  }

  assert(handle.count >= 0);

  proc.fdtable[fd] = null;
  proc.buf[fd] = null;
}

export const SysClose = (fd: number) => {
  return new FcnSyscall(closeImpl, fd);
}

export const readImpl = async (ctx: ProcessContext, fd: number, size: number): Promise<Buffer> => {
  assert(checkFd(ctx, fd), 'read: illegal file descriptor.');

  const vfs = getVfsFromCtx(ctx);
  const handle = getHandle(ctx, fd);
  assert(checkFlags(handle.flags, OpenFlags.READ), 'read: The file is not opened with READ flag.');

  let result = Buffer.alloc(0);
  let readData: Buffer;
  const chunkSize = size < 0 ? CHUNK_SIZE : size;
  do {
    readData = await vfs.read(ctx, handle, chunkSize, handle.pos);
    result = Buffer.concat([result, readData]);
    handle.pos += readData.length;
  } while (readData.length > 0 && size < 0);

  return result;
}

export const SysRead = (fd: number, size: number) => {
  return new FcnSyscall(readImpl, fd, size);
}

export const getLineImpl = async (ctx: ProcessContext, fd: number, delim: string): Promise<{ line: string, eof: boolean }> => {
  assert(checkFd(ctx, fd), 'getLine: illegal file descriptor.');
  let bufData = ctx.proc.buf[fd]!;

  let index: number;
  let newData: Buffer | undefined;
  while ((index = bufData.indexOf(delim)) === -1) {
    newData = await readImpl(ctx, fd, CHUNK_SIZE);
    bufData = Buffer.concat([bufData, newData]);

    if (newData.length === 0) {
      index = bufData.length;
      break;
    }
  }
  
  const line = bufData.slice(0, index).toString();
  ctx.proc.buf[fd] = bufData.slice(index + delim.length);
  return { line, eof: line.length > 0 || !newData ? false : newData.length === 0 }
}

export const SysGetLine = (fd: number, delim: string = '\n') => {
  return new FcnSyscall(getLineImpl, fd, delim);
}

export const writeImpl = async (ctx: ProcessContext, fd: number, data: Buffer): Promise<number> => {
  assert(checkFd(ctx, fd), 'write: illegal file descriptor.');

  const vfs = getVfsFromCtx(ctx);
  const handle = getHandle(ctx, fd);
  assert(checkFlags(handle.flags, OpenFlags.WRITE), 'write: The file is not opened with WRITE flag.');

  const length = await vfs.write(ctx, handle, data, handle.pos);

  handle.pos += length;
  return length;
}

export const SysWrite = (fd: number, data: Buffer) => {
  return new FcnSyscall(writeImpl, fd, data);
}

export const writeAllImpl = async (ctx: ProcessContext, fd: number, data: Buffer): Promise<{ totalLength: number, eof: boolean }> => {
  let nowLength = 0;
  let totalLength = 0;
  data = Buffer.from(data);

  while (data.length > 0) {
    if ((nowLength = await writeImpl(ctx, fd, data)) === 0) {
      break;
    }

    totalLength += nowLength;
    data = data.slice(nowLength);
  }

  return { totalLength, eof: nowLength === 0 };
}

export const SysWriteAll = (fd: number, data: Buffer) => {
  return new FcnSyscall(writeAllImpl, fd, data);
}

export const getdentsImpl = async (ctx: ProcessContext, fd: number): Promise<string[]> => {
  assert(checkFd(ctx, fd), 'getdents: illegal file descriptor.');

  const vfs = getVfsFromCtx(ctx);
  const handle = getHandle(ctx, fd);
  assert(checkFlags(handle.flags, OpenFlags.READ, OpenFlags.DIR), 'write: The file is not opened with both READ and DIR flag.');

  return vfs.list(ctx, handle);
}

export const SysGetdents = (fd: number) => {
  return new FcnSyscall(getdentsImpl, fd);
}

export const statImpl = async (ctx: ProcessContext, path: string): Promise<StatInfo> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.stat(ctx, path);
}

export const SysStat = (path: string) => {
  return new FcnSyscall(statImpl, path);
}

export const chmodImpl = async (ctx: ProcessContext, path: string, mode: number): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.chmod(ctx, path, mode);
}

export const SysChmod = (path: string, mode: number) => {
  return new FcnSyscall(chmodImpl, path, mode);
}

export const chownImpl = async (ctx: ProcessContext, path: string, uid: number, gid: number): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.chown(ctx, path, uid, gid);
}

export const SysChown = (path: string, uid: number, gid: number) => {
  return new FcnSyscall(chownImpl, path, uid, gid);
}

export const creatImpl = async (ctx: ProcessContext, path: string, mode?: number): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.creat(ctx, path, mode);
}

export const SysCreat = (path: string, mode?: number) => {
  return new FcnSyscall(creatImpl, path, mode);
}

export const linkImpl = async (ctx: ProcessContext, target: string, source: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.link(ctx, target, source);
}

export const SysLink = (target: string, source: string) => {
  return new FcnSyscall(linkImpl, target, source);
}

export const symlinkImpl = async (ctx: ProcessContext, target: string, source: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.symlink(ctx, target, source);
}

export const SysSymlink = (target: string, source: string) => {
  return new FcnSyscall(symlinkImpl, target, source);
}

export const unlinkImpl = async (ctx: ProcessContext, path: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.unlink(ctx, path);
}

export const SysUnlink = (path: string) => {
  return new FcnSyscall(unlinkImpl, path);
}

export const mkdirImpl = async (ctx: ProcessContext, path: string, mode?: number): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.mkdir(ctx, path, mode);
}

export const SysMkdir = (path: string, mode?: number) => {
  return new FcnSyscall(mkdirImpl, path, mode);
}

export const rmdirImpl = async (ctx: ProcessContext, path: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.rmdir(ctx, path);
}

export const SysRmdir = (path: string) => {
  return new FcnSyscall(rmdirImpl, path);
}

export const renameImpl = async (ctx: ProcessContext, oldPath: string, newPath: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.rename(ctx, oldPath, newPath);
}

export const SysRename = (oldPath: string, newPath: string) => {
  return new FcnSyscall(renameImpl, oldPath, newPath);
}

export const truncateImpl = async (ctx: ProcessContext, path: string, length: number): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.truncate(ctx, path, length);
}

export const SysTruncate = (path: string, length: number) => {
  return new FcnSyscall(truncateImpl, path, length);
}

export const mountImpl = async (ctx: ProcessContext, path: string, inode: Inode): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.mount(ctx, path, inode);
}

export const SysMount = (path: string, inode: Inode) => {
  return new FcnSyscall(mountImpl, path, inode);
}

export const unmountImpl = async (ctx: ProcessContext, path: string): Promise<void> => {
  const vfs = getVfsFromCtx(ctx);
  return vfs.unmount(ctx, path);
};

export const SysUnmount = (path: string) => {
  return new FcnSyscall(unmountImpl, path);
}

export type FdSet = Array<{ fd: number, flag: PollFlag }>;

export const selectImpl = async (ctx: ProcessContext, fdset: FdSet, timeout?: number) => { // TODO
  const vfs = getVfsFromCtx(ctx);
  const allProm: Promise<number>[] = [];

  if (timeout) {
    allProm.push(new Promise<number>(resolve => sleep(timeout).then(() => resolve(-1))));
  }

  for (const { fd, flag } of fdset) {
    assert(checkFd(ctx, fd), 'select: illegal file descriptor.');
    const handle = getHandle(ctx, fd);
    allProm.push(new Promise<number>(async (resolve) => {
      if (await vfs.poll(ctx, handle, flag, () => resolve(fd))) {
        resolve(fd);
      }
    }));
  }

  return Promise.race(allProm);
}

/**
 * @param timeout The timeout in milliseconds. This parameter has three cases:
 *    1. If the timeout is greater than 0, the function will return before the timeout.
 *    2. If the timeout is not greater than 0, the function will return immediately.
 *    3. If the timeout is undefined, no timeout is set.
 */
export const SysSelect = async (fdset: FdSet, timeout?: number) => {
  return new FcnSyscall(selectImpl, fdset, timeout);
}

export const dup2Impl = async (ctx: ProcessContext, oldFd: number, newFd: number) => {
  const { proc } = ctx;
  assert(checkFd(ctx, oldFd), 'dup2: illegal file descriptor for oldFd.');

  if (oldFd === newFd) {
    return;
  }

  assert(newFd >= 0, 'dup2: illegal file descriptor for newFd.')

  if (checkFd(ctx, newFd)) {
    await closeImpl(ctx, newFd);
  }

  const oldHandle = ctx.proc.fdtable[oldFd]!;
  oldHandle.count++;

  if (proc.fdtable.length - 1 < newFd) {
    proc.fdtable.push(...Array(newFd + 1 - proc.fdtable.length).fill(null));
    proc.buf.push(...Array(newFd + 1 - proc.fdtable.length).fill(null));
  }
  proc.fdtable[newFd] = oldHandle;
  proc.buf[newFd] = Buffer.alloc(0);
}

export const SysDup2 = (oldFd: number, newFd: number) => {
  return new FcnSyscall(dup2Impl, oldFd, newFd);
}


export const pipeImpl = async (ctx: ProcessContext): Promise<{ readFd: number, writeFd: number }> => {
  const { proc } = ctx;
  const stream = new Stream();
  const readPipe = new StreamFile({ mode: 0o777 }, stream), writePipe = new StreamFile({ mode: 0o777 }, stream);
  const handles = [{ inode: readPipe, pos: 0, flags: OpenFlags.READ, count: 1 }, { inode: writePipe, pos: 0, flags: OpenFlags.WRITE, count: 1 }];
  const fds = handles.map(handle => allocFd(proc, handle));
  fds.forEach((fd, idx) => {
    proc.fdtable[fd] = handles[idx];
  });

  return { readFd: fds[0], writeFd: fds[1] };
}

export const SysPipe = () => {
  return new FcnSyscall(pipeImpl);
}
