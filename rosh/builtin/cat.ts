import { OpenFlags, Process, SysClose, SysGetLine, SysOpen, SysWriteAll, Syscall, stdin, stdout } from "../internal";
import { Buffer } from "buffer";


export class Cat extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    const fd = args.length > 0 ? (yield SysOpen(args[0], OpenFlags.READ)) as number : stdin;

    while (true) {
      const result = (yield SysGetLine(fd)) as { line: string, eof: boolean };
      if (result instanceof Error) {
        throw result;
      }

      const { line, eof } = result;
      if (eof) {
        break;
      }
      yield SysWriteAll(stdout, Buffer.from('cat ' + line + '\r\n'));
    }

    if (fd !== stdin) {
      yield SysClose(fd);
    }

    return 0;
  }
}