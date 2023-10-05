import { Process, SysEnvironment, SysGetenv, SysMkdir, SysWriteAll, Syscall, stdout } from "../internal";
import { Buffer } from "buffer";


export class Env extends Process {
  async *run(): AsyncGenerator<Syscall, number, unknown> {
    const env = (yield SysEnvironment()) as Record<string, string>;
    yield SysWriteAll(stdout, Buffer.from(Object.entries(env).map(entry => entry.join('=')).join('\r\n') + '\r\n'));
    
    return 0;
  }
}