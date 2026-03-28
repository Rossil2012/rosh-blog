import { Process, SysWriteAll, Syscall, stdout } from "../internal";
import { Buffer } from "buffer";


export class Echo extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    yield SysWriteAll(stdout, Buffer.from(args.join(' ') + '\r\n'));
    
    return 0;
  }
}