import { assert } from "./helper";
import { PollFlag } from "../internal";
import { Buffer } from "buffer";

export class Stream {
  private buffer_: Buffer;
  private bufferSize_: number;
  private pendingReads_: Array<{ size: number, resolve: (buffer: Buffer) => void }>;
  private pendingWrites_: Array<{ data: Buffer, resolve: (written: number) => void }>;
  private pendingReadPolls_: Array<{ resolve: () => void }>;
  private pendingWritePolls_: Array<{ resolve: () => void }>;
  private isClosed_: boolean;

  constructor(bufferSize?: number) {
    this.bufferSize_ = bufferSize ?? Infinity;
    this.buffer_ = Buffer.alloc(0);
    this.pendingReads_ = [];
    this.pendingWrites_ = [];
    this.pendingReadPolls_ = [];
    this.pendingWritePolls_ = [];
    this.isClosed_ = false;
  }

  private readyToRead_(): boolean {
    return this.buffer_.length > 0;
  }

  private readyToWrite_(): boolean {
    return this.buffer_.length < this.bufferSize_;
  }

  private push_(data: Buffer): number {
    const toPush = data.slice(0, Math.min(this.bufferSize_ - this.buffer_.length, data.length));
    this.buffer_ = Buffer.concat([this.buffer_, toPush]);
    return toPush.length;
  }

  private top_(size: number): Buffer {
    const topData = this.buffer_.slice(0, Math.min(size, this.buffer_.length));
    this.buffer_ = this.buffer_.slice(topData.length);
    return topData;
  }

  private resolveAll_(pending: Array<{ resolve: () => void }>) {
    for (const { resolve } of pending) {
      resolve();
    }
  }

  close() {
    this.isClosed_ = true;

    while (this.pendingReads_.length > 0) {
      const { resolve: readResolve } = this.pendingReads_.shift()!;
      readResolve(Buffer.alloc(0));
    }

    while (this.pendingWrites_.length > 0) {
      const { resolve: writeResolve } = this.pendingWrites_.shift()!;
      writeResolve(0);
    }
  }

  isClosed(): boolean {
    return this.isClosed_;
  }

  async read(size: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      if (this.isClosed_ && this.buffer_.length === 0) {
        resolve(Buffer.alloc(0));
        return;
      }

      if (this.readyToRead_()) {
        resolve(this.top_(size));
      } else {
        this.pendingReads_.push({ size, resolve });
      }

      while (this.pendingWrites_.length > 0 && this.readyToWrite_()) {
        const { data: writeData, resolve: writeResolve } = this.pendingWrites_.shift()!;
        writeResolve(this.push_(writeData));
      }

      if (this.readyToWrite_()) {
        this.resolveAll_(this.pendingWritePolls_);
      }
    });
  }

  async write(data: Buffer): Promise<number> {
    return new Promise<number>((resolve) => {
      if (this.isClosed_) {
        resolve(0);
        return;
      }

      if (this.readyToWrite_()) {
        const length = this.push_(data);
        while (this.pendingReads_.length > 0 && this.readyToRead_()) {
          const { size, resolve: readResolve } = this.pendingReads_.shift()!;
          readResolve(this.top_(size));
        }
        resolve(length);
      } else {
        this.pendingWrites_.push({ data, resolve});
      }

      if (this.readyToRead_()) {
        this.resolveAll_(this.pendingReadPolls_);
      }
    });
  }

  async poll(flag: PollFlag, resolve: () => void): Promise<boolean> {
    if ((flag === PollFlag.READ && this.readyToRead_()) || (flag === PollFlag.WRITE && this.readyToWrite_())) {
      return true;
    }

    if (flag === PollFlag.READ) {
      this.pendingReadPolls_.push({ resolve });
    } else if (flag === PollFlag.WRITE) {
      this.pendingWritePolls_.push({ resolve });
    } else {
      assert(0);
    }
    
    return false;
  }
}