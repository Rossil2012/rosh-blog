import { assert, Stream, ProcessContext, File, FileHandle, PollFlag, getVfsFromCtx } from '../internal';
import { Buffer } from "buffer";

/* Pseudo Terminal Slave */
export class PtsFile extends File {
  private readStream_: Stream;
  private writeStream_: Stream;
  
  constructor(readStream: Stream, writeStream: Stream, uid: number) {
    super({ mode: 0o620, uid });
    this.readStream_ = readStream;
    this.writeStream_ = writeStream;
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    return this.readStream_.read(size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    return this.writeStream_.write(data);
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    if (flag === PollFlag.READ) {
      return this.readStream_.poll(flag, resolve);
    } 

    if (flag === PollFlag.WRITE) {
      return this.writeStream_.poll(flag, resolve);
    }

    assert(0);
    return false;
  }
}

export interface PtsEntry {
  idx: number;
  readStream: Stream;
  writeStream: Stream;
}

/* Pseudo Terminal Master Multiplexer */
export class PtmxFile extends File {
  private cnt_: number;
  private openPt_: Map<FileHandle, PtsEntry>;

  constructor() {
    super({ mode: 0o666, uid: 0, gid: 0 });
    this.cnt_ = 0;
    this.openPt_ = new Map();
  }

  private getEntry_(handle: FileHandle): PtsEntry {
    const pts = this.openPt_.get(handle)!;
    return pts;
  }
  
  async open(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    const readStream = new Stream();
    const writeStream = new Stream();
    const vfs = getVfsFromCtx(ctx);
    
    const pts = new PtsFile(writeStream, readStream, ctx.proc.uid);
    this.openPt_.set(handle, { idx: this.cnt_, readStream, writeStream });
    await vfs.mount(ctx, `/dev/pts/${this.cnt_}`, pts);
    
    const ptsInfo = Buffer.alloc(4);
    ptsInfo.writeUInt32LE(this.cnt_++, 0);
    await readStream.write(ptsInfo);
  }

  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    const entry = this.getEntry_(handle);
    const vfs = getVfsFromCtx(ctx);
    await vfs.unmount(ctx, `/dev/pts/${entry.idx}`);
    assert(this.openPt_.delete(handle));
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const { readStream } = this.getEntry_(handle);
    return readStream.read(size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    return this.writeInner(handle, data);
  }

  writeInner(handle: FileHandle, data: Buffer): Promise<number> {
    const { writeStream } = this.getEntry_(handle);
    return writeStream.write(data);
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    const { readStream, writeStream } = this.getEntry_(handle);
    if (flag === PollFlag.READ) {
      return await readStream.poll(flag, resolve);
    }

    if (flag === PollFlag.WRITE) {
      return await writeStream.poll(flag, resolve);
    }

    assert(0);
    return false;
  }
}