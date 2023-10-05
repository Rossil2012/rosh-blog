import { Process, SysRead, SysSpawnPty, Syscall, stdin, stdout, stderr, PtmxFile, FileHandle, getUTF8String, Rosh } from "../internal";
import { Buffer } from "buffer";

export type DataCallback = (data: string) => void;

const CHUNK_SIZE = 64;

export class RoshConnection extends Process {
  private ptmx_: PtmxFile;
  private ptmxHandle_: FileHandle | undefined;
  private callback_!: DataCallback;
  private pendingWrites_: Array<{ resolve: (n: number | PromiseLike<number>) => void, data: string }>;

  constructor(ptmx: PtmxFile) {
    super();
    this.ptmx_ = ptmx;
    this.pendingWrites_ = [];
  }
  
  onData(callback: DataCallback) {
    this.callback_ = callback;
  }

  async write(data: string) {
    return new Promise<number>(async (resolve) => {
      if (this.ptmxHandle_) {
        for (const { resolve: pendingResolve, data: pendingData } of this.pendingWrites_) {
          pendingResolve(await this.ptmx_.writeInner(this.ptmxHandle_, Buffer.from(pendingData, 'utf8')));
        }
        resolve(await this.ptmx_.writeInner(this.ptmxHandle_, Buffer.from(data, 'utf8'))); // TODO: writeAll
      } else {
        this.pendingWrites_.push({ resolve, data });
      }
    });
  }

  async *run(): AsyncGenerator<Syscall, number, unknown> {
    const { ptmxFd } = <{ ptmxFd: number, pid: number }>(yield SysSpawnPty(Rosh));
    console.log(ptmxFd);
    this.ptmxHandle_ = this.fdtable[ptmxFd]!;

    let newData: Buffer;
    let buffer: Buffer = Buffer.alloc(0);

    while ((newData = <Buffer>(yield SysRead(ptmxFd, CHUNK_SIZE))) && newData.length > 0) {
      buffer = Buffer.concat([buffer, newData]);

      let { parsedStr, newBuffer } = getUTF8String(buffer);
      buffer = newBuffer;

      if (parsedStr.length > 0) {
        this.callback_?.(parsedStr);
      }
    }

    return 0;
  }
}