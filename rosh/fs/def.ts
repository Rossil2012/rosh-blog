import { ProcessContext } from "../internal";
import { Buffer } from "buffer";

export type FileHandle = {
  inode: Inode;
  pos: number;
  flags: OpenFlags;
  count: number
};

export type inodeType = 'file' | 'dir' | 'symlink';

export const enum Mode {
  READ = 0x4,
  WRITE = 0x2,
  EXEC = 0x1
};

export type InodeAttr = {
  size: number;
  mode: number;
  uid: number;
  gid: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  count: number;
  mount: boolean;
};

export type AttrInfo = Partial<Omit<InodeAttr, 'count'>>;

export type StatInfo = InodeAttr & {
  type: inodeType;
};

export const enum PollFlag {
  READ, WRITE
}

export interface InodeMethod {
  open(ctx: ProcessContext, handle: FileHandle): Promise<void>;
  release(ctx: ProcessContext, handle: FileHandle): Promise<void>;
  stat(ctx: ProcessContext): Promise<StatInfo>;
  setAttr(ctx: ProcessContext, attr: AttrInfo): Promise<void>;
  permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean>;
}

export interface InodeProto extends InodeAttr, InodeMethod {};

export interface FileMethod {
  read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>;
  write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>;
  poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean>;
};

export interface FileProto extends InodeProto, FileMethod {};

export interface DirMethod {
  list(ctx: ProcessContext, ): Promise<string[]>;
  lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined>;
  rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void>;
  create(ctx: ProcessContext, name: string, mode: number): Promise<void>;
  link(ctx: ProcessContext, name: string, source: Inode): Promise<void>;
  symlink(ctx: ProcessContext, name: string, source: string): Promise<void>;
  unlink(ctx: ProcessContext, name: string): Promise<Inode>;
  mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void>;
  rmdir(ctx: ProcessContext, name: string): Promise<void>;
};

export interface DirProto extends InodeProto, DirMethod {};

export interface SymlinkMethod {
  readlink(ctx: ProcessContext): Promise<string>;
}

export interface SymlinkProto extends InodeProto, SymlinkMethod {};

export const enum OpenFlags {
  READ = 0x1,
  WRITE = READ << 1,
  CREAT  = READ << 2,
  DIR = READ << 3,
  TRUNC = READ << 4,
  APPEND = READ << 5
};

export const fileMask = 0o666;
export const dirMask = 0o777;

export class Inode implements InodeProto {
  size: number;
  mode: number;
  uid: number;
  gid: number;
  count: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  mount: boolean;

  constructor({ size, mode, uid, gid, count, atime, mtime, ctime, mount }: Partial<InodeAttr>) {
    this.size = size ?? 0;
    this.mode = mode ?? isDir(this) ? dirMask : fileMask;
    this.uid = uid ?? 0;
    this.gid = gid ?? 0;
    this.count = count ?? 0;

    const now = new Date();
    this.atime = atime ?? new Date(now);
    this.mtime = mtime ?? new Date(now);
    this.ctime = ctime ?? new Date(now);
    this.mount = mount ?? false;
  }

  async open(ctx: ProcessContext, handle: FileHandle): Promise<void> {}
  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {}

  async stat(ctx: ProcessContext): Promise<StatInfo> {
    return {
      type: isFile(this) ? 'file' : (isDir(this) ? 'dir' : 'symlink'),
      mode: this.mode,
      count: this.count,
      uid: this.uid,
      gid: this.gid,
      size: this.size,
      atime: this.atime,
      mtime: this.mtime,
      ctime: this.ctime,
      mount: this.mount
    };
  }

  async setAttr(ctx: ProcessContext, attr: AttrInfo): Promise<void> {
    this.size = attr.size ?? this.size;
    this.mode = attr.mode ?? this.mode;
    this.uid = attr.uid ?? this.uid;
    this.gid = attr.gid ?? this.gid;
    this.atime = attr.atime ?? this.atime;
    this.mtime = attr.mtime ?? this.mtime;
    this.ctime = attr.ctime ?? this.ctime;
  }

  async permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean> {
    if (uid === 0) {
      return true;
    }

    let pass = true;
    for (const p of perms) {
      if (uid === this.uid) { // TODO
        pass &&= (this.mode & (p << 6)) !== 0;
      } else if (gid.includes(this.gid)) {
        pass &&= (this.mode & (p << 3)) !== 0;
      } else {
        pass &&= (this.mode & p) !== 0;
      }
    }

    return pass;
  }
}

export class File extends Inode implements FileProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    throw new Error('EOPNOTSUPP');
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    throw new Error('EOPNOTSUPP');
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    return true;
  }
}

export class Dir extends Inode implements DirProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    throw new Error('EOPNOTSUPP');
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    throw new Error('EOPNOTSUPP');
  }

  async rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async create(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async link(ctx: ProcessContext, name: string, source: Inode): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async symlink(ctx: ProcessContext, name: string, source: string): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async unlink(ctx: ProcessContext, name: string): Promise<Inode> {
    throw new Error('EOPNOTSUPP');
  }

  async mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async rmdir(ctx: ProcessContext, name: string): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }
}

export class Symlink extends Inode implements SymlinkProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  async readlink(ctx: ProcessContext): Promise<string> {
    throw new Error('EOPNOTSUPP');
  }
}

export const isFile = (inode: Inode): inode is File => {
  return inode instanceof File;
}

export const isDir = (inode: Inode): inode is Dir => {
  return inode instanceof Dir;
}

export const isSymlink = (inode: Inode): inode is Symlink => {
  return inode instanceof Symlink;
}

export type CurrentInfo = {
  uid: number;
  gid: number[];
  umask: number;
};

export const getCurrent = (ctx: ProcessContext) => {
  return { uid: ctx.proc.uid, gid: ctx.proc.gid, umask: ctx.proc.umask };
}