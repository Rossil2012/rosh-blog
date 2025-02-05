import { CoreDir, BinFile, Rosh, Echo, Cat, Env, Ls, CoreFile, ProcSelfSymlink, CoreSymlink, Inode, ProcDir } from "../internal";
import { Buffer } from "buffer";

const etcProfileContent = `
export PATH=/usr/bin:/bin
export TEST=test123
`;

export class InitImage extends CoreDir {
  constructor() {
    const binFile = [Rosh, Echo, Cat, Env, Ls];
    const binFileName = ['rosh', 'echo', 'cat', 'env', 'ls'];
    const etcProfile = new CoreFile({ mode: 0o755 }, Buffer.from(etcProfileContent));
    const rootUsrBin = new CoreDir({ mode: 0o755 }, 
      new Map(binFile.map((executable, index) => [`${binFileName[index].toLowerCase()}`, new BinFile({ mode: 0o755 }, executable)])));
    // const rootBin = new CoreDir({ mode: 0o755 });
    const rootBin = new CoreSymlink('/usr/bin', {});
    const rootHome = new CoreDir({ mode: 0o755 });
    const rootRoot = new CoreDir({ mode: 0o755 });
    const rootUsr = new CoreDir({ mode: 0o755 }, new Map([['bin', rootUsrBin]]));
    const rootEtc = new CoreDir({ mode: 0o755 }, new Map([['profile', etcProfile]]));
    const rootProc = new ProcDir();
    const sysDir = new Map<string, Inode>([['bin', rootBin], ['etc', rootEtc], ['home', rootHome], ['root', rootRoot], ['usr', rootUsr], ['proc', rootProc]]);
    super({ uid: 0, gid: 0, mode: 0o755 }, sysDir);
  }
}