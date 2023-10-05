import { Process, Syscall, ProcessContext, spawnImpl, FileHandle, OpenFlags, StreamFile, 
  vfs, Chan, assert, findOrPushNullEntry, PtmxFile, RoshConnection, mkdirImpl, mountImpl, Entrypoint, initVfs, InitImage } from "../internal";

import { Buffer } from "buffer";

interface ReadyRequest {
  proc: Process,
  result?: unknown
}

class MockProcess extends Process {
  constructor() {
    super();
    this.pid = 0;
    this.pgid = 0;
    this.uid = 0;
    this.gid = [0];
    this.fdtable = [];
    this.buf = [];
    this.env = {};
    this.cwd = '/';

    const allFlags = [OpenFlags.READ, OpenFlags.WRITE, OpenFlags.WRITE];

    for (let fd = 0; fd < 3; fd++) {
      const inode = new StreamFile({ mode: 0o777 });
      const handle: FileHandle = { inode, pos: 0, flags: allFlags[fd], count: 1 };
      
      this.fdtable.push(handle);
      this.buf.push(Buffer.alloc(0));
    }
  }

  async *run(): Entrypoint {
    return 0;
  }
}

export class Kernel {
  private allProcs_: Array<Process | null>;
  private allProcGroups_: Map<number, Set<number>>;
  private readyChan_: Chan<ReadyRequest>;
  private ctx_!: ProcessContext;
  private ptmx_!: PtmxFile;

  private static instance_: Kernel;

  public static async getInstance(): Promise<Kernel> {
    if (!Kernel.instance_) {
      Kernel.instance_ = new Kernel();
      await Kernel.instance_.init_();
    }
    return Kernel.instance_;
  }

  private constructor() {
    this.allProcs_ = [];
    this.allProcGroups_ = new Map();
    this.readyChan_ = new Chan();
  }

  private async init_() {
    this.ctx_ = { proc: new MockProcess() };
    initVfs(new InitImage());
    await mkdirImpl(this.ctx_, '/dev', 0o755);
    await mkdirImpl(this.ctx_, '/dev/pts', 0o755);
    this.ptmx_ = new PtmxFile();
    await mountImpl(this.ctx_, '/dev/ptmx', this.ptmx_);
  }

  private buildContext_(proc: Process): ProcessContext {
    return { proc };
  }

  private execSyscallAsync_(proc: Process, syscall: Syscall) {
    setTimeout(async () => {
      let result: unknown;
      try {
        result = await syscall.exec(this.buildContext_(proc));
      } catch (err: unknown) {
        result = err;
      } finally {
        await this.readyChan_.put({ proc, result });
      }
      proc.state = Process.STATE.READY;
    });
  }

  getAllProcess(): Process[] {
    const allProcs: Process[] = [];
    for (const proc of this.allProcs_) {
      proc && allProcs.push(proc);
    }

    return allProcs;
  }

  getProcess(pid: number): Process | undefined {
    return this.allProcs_[pid] ?? undefined;
  }

  removeProcess(pid: number) {
    assert(pid < this.allProcs_.length && this.allProcs_[pid]);
    const proc = this.allProcs_[pid]!;
    const procGroup = this.allProcGroups_.get(proc.pgid)!;
    procGroup.delete(pid);
    if (procGroup.size === 0) {
      this.allProcGroups_.delete(proc.pgid);
    }
    this.allProcs_[pid] = null;
  }

  getProcessGroup(pgid: number): Set<number> | undefined {
    return this.allProcGroups_.get(pgid)
  }

  async newConnection(): Promise<RoshConnection> {
    const pid = await spawnImpl(this.ctx_, RoshConnection, this.ptmx_);
    return this.allProcs_[pid]! as RoshConnection;
  }

  async createProcess(proc: Process, pid?: number): Promise<number> {
    pid ??= findOrPushNullEntry(this.allProcs_);

    proc.pid = pid;
    if (!this.allProcGroups_.has(proc.pgid)) {
      this.allProcGroups_.set(proc.pgid, new Set());
    }
    this.allProcGroups_.get(proc.pgid)!.add(pid);
    proc.state = Process.STATE.READY;
    this.allProcs_[pid] = proc;
    await this.readyChan_.put({ proc });

    return pid;
  }

  async schedule() {
    while (true) {
      const { proc, result } = await this.readyChan_.get() as ReadyRequest;

      try {
        proc.state = Process.STATE.RUNNING;
        let { value, done } = await proc.gen.next(result);
        proc.state = Process.STATE.BLOCKED;
        
        if (done) {
          await proc.return(value as number);
          continue;
        }

        this.execSyscallAsync_(proc, value as Syscall);
      } catch (err: unknown) {
        await proc.return(-1);
      }
    }
  }
}
