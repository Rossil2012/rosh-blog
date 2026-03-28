import { File, InodeAttr, PollFlag, FileHandle, Stream, ProcessContext } from "../internal";
import { Buffer } from "buffer";


export class StreamFile extends File {
  private stream_: Stream;

  constructor(attr: Partial<InodeAttr>, stream?: Stream) {
    super(attr);
    this.stream_ = stream ?? new Stream();
  }

  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    this.stream_.close();
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    return await this.stream_.read(size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    return this.stream_.write(data);
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    return this.stream_.poll(flag, resolve);
  }
}