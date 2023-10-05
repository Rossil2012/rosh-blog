import { Inode, File, Dir, Symlink, InodeAttr, AttrInfo, isDir, getCurrent, FileHandle, ProcessContext, assert, Kernel, Process, readImpl, writeImpl } from '../internal';
import { Buffer } from "buffer";

export class ProcSelfSymlink extends Symlink {
  constructor() {
    super({ mode: 0o777 });
  }

  async readlink(ctx: ProcessContext): Promise<string> {
    return `/proc/${ctx.proc.pid}`;
  }
}

export class ProcPidFdFile extends File {
  private proc_: Process;
  private fd_: number;
  constructor(proc: Process, fd: number) {
    super({ mode: 0o700 });
    this.proc_ = proc;
    this.fd_ = fd;
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    return readImpl({ proc: this.proc_ }, this.fd_, size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    return writeImpl({ proc: this.proc_ }, this.fd_, data);
  }
}

export class ProcPidFdDir extends Dir {
  private proc_: Process;

  constructor(proc: Process) {
    super({ mode: 0o500 });
    this.proc_ = proc;
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    const fileNames: string[] = [];
    this.proc_.fdtable.forEach((handle, idx) => handle && fileNames.push(String(idx)));
    return fileNames;
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    const fd = Number(name);
    if (!ctx.proc.fdtable[Number(name)]) {
      return undefined;
    }

    return new ProcPidFdFile(ctx.proc, fd);
  }
}

export class ProcPidDir extends Dir {
  private proc_: Process;

  constructor(proc: Process) {
    super({ mode: 0o555 });
    this.proc_ = proc;
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    return ['fd'];
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    switch (name) {
      case 'fd':
        return new ProcPidFdDir(this.proc_)
      default:
        return undefined
    }
  }
}

export class ProcDir extends Dir {
  constructor() {
    super({ mode: 0o555 });
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    const kernel = await Kernel.getInstance();
    const allProcs = kernel.getAllProcess();

    const fileNames: string[] = [];
    for (const proc of allProcs) {
      fileNames.push(String(proc.pid));
    }

    fileNames.push('self');

    return fileNames;
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    switch (name) {
      case 'self':
        return new ProcSelfSymlink();
      default: {
        const kernel = await Kernel.getInstance();
        const proc = kernel.getProcess(Number(name));

        if (!proc) {
          return undefined;
        }
    
        return new ProcPidDir(proc);
      }
    }
  }
}