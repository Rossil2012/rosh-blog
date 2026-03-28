import { CoreDir, BinFile, Rosh, Echo, Cat, Env, Ls, CoreFile, CoreSymlink, Inode, ProcDir, PtmxFile, isDir } from "../internal";
import { Buffer } from "buffer";

/// [Cls, ...args]
type FSConfig = [any, ...any[]];

/// { 'name': [Cls, ...args] }
interface FSConfigMap {
  [name: string]: FSConfig;
}

type InodeMap = Map<string, Inode>;

/// Special marker for children, which should be recursively built
class ChildrenMarker {
  constructor(public children: FSConfigMap) {}

  static isChildrenArg(obj: any): obj is ChildrenMarker {
    return obj instanceof ChildrenMarker;
  }

  inner(): FSConfigMap {
    return this.children;
  }
}

const markChildren = (children: FSConfigMap): ChildrenMarker => {
  return new ChildrenMarker(children);
}

const buildInode = (config: FSConfig): Inode => {
  const Cls = config[0];
  let args = config.slice(1);

  for (let i = 0; i < args.length; i++) {
    if (ChildrenMarker.isChildrenArg(args[i])) {
      args[i] = buildInodeMap(args[i].inner());
      break;
    }
  }

  return new Cls(...args);
}

const buildInodeMap = (config: FSConfigMap): InodeMap => {
  return new Map(
    Object.entries(config).map(([name, cfg]) => [name, buildInode(cfg)])
  );
}

const etcProfileContent = `
export PATH=/usr/bin:/bin
export TEST=test123
`;

const imageConfig: FSConfigMap = {
  "bin": [CoreSymlink, '/usr/bin', {}],
  "etc": [CoreDir, { mode: 0o755 }, markChildren({
    "profile": [CoreFile, { mode: 0o755 }, Buffer.from(etcProfileContent)]
  })],
  "home": [CoreDir, { mode: 0o755 }],
  "root": [CoreDir, { mode: 0o755 }],
  "usr": [CoreDir, { mode: 0o755 }, markChildren({
    "bin": [CoreDir, { mode: 0o755 }, markChildren({
      "rosh": [BinFile, { mode: 0o755 }, Rosh],
      "echo": [BinFile, { mode: 0o755 }, Echo],
      "cat":  [BinFile, { mode: 0o755 }, Cat],
      "env":  [BinFile, { mode: 0o755 }, Env],
      "ls":   [BinFile, { mode: 0o755 }, Ls]
    })]
  })],
  "proc": [ProcDir],
  // "dev": [CoreDir, { mode: 0o755 }, markChildren({
  //   "ptmx": [PtmxFile],
  //   "pts":  [CoreDir, { mode: 0o755 }]
  // })]
};

export class InitImage extends CoreDir {
  constructor() {
    const sysDir = buildInodeMap(imageConfig);
    super({ uid: 0, gid: 0, mode: 0o755 }, sysDir);
  }
}