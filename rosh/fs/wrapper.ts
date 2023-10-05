import { Inode, File, Dir, Symlink, InodeMethod, FileMethod, DirMethod as OrigDirMethod, SymlinkMethod, StatInfo, AttrInfo, 
  isFile, isDir, isSymlink, PollFlag, FileHandle, ProcessContext } from "../internal";
import { Buffer } from "buffer";

interface DirMethod extends Omit<OrigDirMethod, 'lookup'> {
  lookup(ctx: ProcessContext, name: string): Promise<InodeWrapper | undefined>;
};

export class InodeWrapper implements InodeMethod {
  impl!: Inode

  constructor(impl?: Inode) {
    this.impl = impl ?? this.impl;
  }

  async open(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    return this.impl.open(ctx, handle);
  }

  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    return this.impl.release(ctx, handle);
  }

  async stat(ctx: ProcessContext): Promise<StatInfo> {
    return this.impl.stat(ctx);
  }

  async setAttr(ctx: ProcessContext, attr: Partial<AttrInfo>): Promise<void> {
    await this.impl.setAttr(ctx, attr);
    this.impl.ctime = new Date();
  }

  async permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean> {
    return this.impl.permission(ctx, uid, gid, ...perms);
  }
}

export class FileWrapper extends InodeWrapper implements FileMethod {
  impl: File;

  constructor(impl: File) {
    super();
    this.impl = impl;
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const ret = await this.impl.read(ctx, handle, size, offset);
    this.impl.atime = new Date();
    return ret;
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    const ret = await this.impl.write(ctx, handle, data, offset);

    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
    
    return ret;
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    return this.impl.poll(ctx, handle, flag, resolve);
  }
}

export class DirWrapper extends InodeWrapper implements DirMethod {
  impl: Dir;

  constructor(impl: Dir) {
    super();
    this.impl = impl;
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    const ret = await this.impl.list(ctx);
    this.impl.atime = new Date();
    return ret;
  }

  async lookup(ctx: ProcessContext, name: string): Promise<InodeWrapper | undefined> {
    const inode = await this.impl.lookup(ctx, name);
    if (!inode) {
      return undefined;
    }

    if (isFile(inode)) {
      return new FileWrapper(inode);
    } else if (isDir(inode)) {
      return new DirWrapper(inode);
    } else if (isSymlink(inode)) {
      return new SymlinkWrapper(inode);
    }

    return undefined;
  }

  async rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void> {
    await this.impl.rename(ctx, oldName, newName);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
  }

  async create(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    await this.impl.create(ctx, name, mode);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
  }

  async link(ctx: ProcessContext, name: string, target: Inode): Promise<void> {
    await this.impl.link(ctx, name, target);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
    target.ctime = new Date(now);
  }

  async symlink(ctx: ProcessContext, name: string, target: string): Promise<void> {
    await this.impl.symlink(ctx, name, target);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
  }

  async unlink(ctx: ProcessContext, name: string): Promise<Inode> {
    const inode = await this.impl.unlink(ctx, name);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
    inode.ctime = new Date(now);

    return inode;
  }

  async mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    await this.impl.mkdir(ctx, name, mode);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
  }

  async rmdir(ctx: ProcessContext, name: string): Promise<void> {
    await this.impl.rmdir(ctx, name);
    
    const now = new Date();
    this.impl.mtime = new Date(now);
    this.impl.ctime = new Date(now);
  }
}

export class SymlinkWrapper extends InodeWrapper implements SymlinkMethod {
  impl: Symlink;

  constructor(impl: Symlink) {
    super();
    this.impl = impl;
  }

  async readlink(ctx: ProcessContext): Promise<string> {
    return this.impl.readlink(ctx);
  }
}

export const isFileWrapper = (inode: InodeWrapper): inode is FileWrapper => {
  return inode instanceof FileWrapper;
}

export const isDirWrapper = (inode: InodeWrapper): inode is DirWrapper => {
  return inode instanceof DirWrapper;
}

export const isSymlinkWrapper = (inode: InodeWrapper): inode is SymlinkWrapper => {
  return inode instanceof SymlinkWrapper;
}