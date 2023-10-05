import { OpenFlags, Process, SysClose, SysGetcwd, SysGetdents, SysMkdir, SysOpen, SysWriteAll, Syscall, stdout } from "../internal";
import { Buffer } from "buffer";


export class Ls extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    const pwd = (yield SysGetcwd()) as string;
    const fd = (yield SysOpen(pwd, OpenFlags.DIR | OpenFlags.READ)) as number;
    const entries = (yield SysGetdents(fd)) as string[];
    console.log('ls', pwd, fd, entries);
    yield SysClose(fd);
    yield SysWriteAll(stdout, Buffer.from(entries.join('\r\n') + '\r\n'));
    
    return 0;
  }
}