import { CoreDir, Inode, StatInfo, Mode, OpenFlags, fileMask, dirMask, getCurrent, isFile, PollFlag, FileHandle,
  DirWrapper, InodeWrapper, FileWrapper, isFileWrapper, isDirWrapper, isSymlinkWrapper, ProcessContext, assert, resolvePath, Dir, isDir, checkBitFlags } from "../internal";
import { Buffer } from "buffer";


export interface IVFS {
  open(ctx: ProcessContext, path: string, flags: number, mode?: number): Promise<FileHandle>;
  release(ctx: ProcessContext, handle: FileHandle): Promise<void>;
  read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>;
  write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>;
  list(ctx: ProcessContext, handle: FileHandle): Promise<string[]>;
  poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean>;
  stat(ctx: ProcessContext, path: string): Promise<StatInfo>;
  chmod(ctx: ProcessContext, path: string, mode: number): Promise<void>;
  chown(ctx: ProcessContext, path: string, uid: number, gid: number): Promise<void>;
  creat(ctx: ProcessContext, path: string, mode?: number): Promise<void>;
  link(ctx: ProcessContext, target: string, source: string): Promise<void>;
  symlink(ctx: ProcessContext, target: string, source: string): Promise<void>;
  unlink(ctx: ProcessContext, path: string): Promise<void>;
  mkdir(ctx: ProcessContext, path: string, mode?: number): Promise<void>;
  rmdir(ctx: ProcessContext, path: string): Promise<void>;
  rename(ctx: ProcessContext, oldPath: string, newPath: string): Promise<void>;
  truncate(ctx: ProcessContext, path: string, length: number): Promise<void>;

  inode(ctx: ProcessContext, path: string): Promise<InodeWrapper>;
  chdir(ctx: ProcessContext, path: string): Promise<boolean>;
  mount(ctx: ProcessContext, path: string, inode: Inode): Promise<void>;
  unmount(ctx: ProcessContext, path: string): Promise<void>;
};

export class VFS implements IVFS {
  private root_: DirWrapper;
  private maxSymlinkDepth_: number;

  constructor(root?: Dir) {
    this.root_ = new DirWrapper(root ?? new CoreDir({ uid: 0, gid: 0, mode: 0o755 }));
    this.maxSymlinkDepth_ = 20;
  }

  private async getParent_(ctx: ProcessContext, path: string, depth: number = 0): Promise<{ parent: DirWrapper, name: string}> {
    assert(depth <= this.maxSymlinkDepth_, 'ELOOP');

    const parts = resolvePath(path);
    if (parts.length === 0) {
      return { parent: this.root_, name: '' };
    }
    const name = parts.pop();
    assert(name, 'ENOENT');

    let now: InodeWrapper | undefined = this.root_;
    assert(isDirWrapper(now), 'ENOTDIR');


    const { uid, gid } = getCurrent(ctx);
    for (const part of parts) {
      now = await now.lookup(ctx, part);
      assert(now, 'ENOENT');

      if (isSymlinkWrapper(now)) {
        now = (await this.getInode_(ctx, await now.readlink(ctx), false, depth + 1)).inode;
      }
      
      assert(isDirWrapper(now), 'ENOTDIR');
      assert(await now.permission(ctx, uid, gid, Mode.EXEC), 'EACCES');
    }

    return { parent: now, name };
  }

  private async getInode_(ctx: ProcessContext, path: string, returnSymol: boolean = false, depth: number = 0): Promise<{ inode: InodeWrapper, parent: DirWrapper, name: string }> {
    assert(depth <= this.maxSymlinkDepth_, 'ELOOP');

    const { parent, name } = await this.getParent_(ctx, path, depth);
    let inode: InodeWrapper | undefined;
    if (name === '') {
      inode = parent;
    } else {
      assert(parent.lookup, 'EOPNOTSUPP');
      inode = await parent.lookup(ctx, name);
      assert(inode, 'ENOENT');
    }

    if (isSymlinkWrapper(inode) && !returnSymol) {
      inode = (await this.getInode_(ctx, await inode.readlink(ctx), false, depth + 1)).inode;
    }

    return { inode, parent, name };
  }

  async open(ctx: ProcessContext, path: string, flags: number, mode?: number | undefined): Promise<FileHandle> {
    let inode: InodeWrapper | undefined;

    const { uid, gid, umask } = getCurrent(ctx);
    if (checkBitFlags(flags, OpenFlags.CREAT)) {
      const { parent, name } = await this.getParent_(ctx, path);
      assert(await parent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');
      inode = await parent.lookup(ctx, name);
      if (!inode) {
        await parent.create(ctx, name, mode ?? fileMask ^ umask);
        inode = await parent.lookup(ctx, name);
      }
    }

    inode ??= (await this.getInode_(ctx, path)).inode;

    if (isFileWrapper(inode) && checkBitFlags(flags, OpenFlags.TRUNC, OpenFlags.WRITE)) {
      assert(await inode.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');
      await inode.setAttr(ctx, { size: 0 });
    }

    if (isDirWrapper(inode) && !checkBitFlags(flags, OpenFlags.DIR)) {
      throw new Error('EISDIR');
    }

    const handle = { inode: inode.impl, pos: 0, flags, count: 1 };
    await inode.open(ctx, handle);

    return handle;
  }

  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {
    assert(handle.count === 0, 'EDEBUG');
    const inode = new InodeWrapper(handle.inode);
    await inode.release(ctx, handle);
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    assert(isFile(handle.inode), 'EISDIR');
    const inode = new FileWrapper(handle.inode);

    const { uid, gid } = getCurrent(ctx);
    assert(await inode.permission(ctx, uid, gid, Mode.READ), 'EACCES');

    return inode.read(ctx, handle, size, offset);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    assert(isFile(handle.inode), 'EISDIR');
    const inode = new FileWrapper(handle.inode);

    const { uid, gid } = getCurrent(ctx);
    assert(await inode.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    if (checkBitFlags(handle.flags, OpenFlags.APPEND)) {
      offset = handle.pos = (await inode.stat(ctx)).size;
    }

    return inode.write(ctx, handle, data, offset);
  }

  async list(ctx: ProcessContext, handle: FileHandle): Promise<string[]> {
    assert(isDir(handle.inode), 'EISDIR');
    const inode = new DirWrapper(handle.inode);

    const { uid, gid } = getCurrent(ctx);
    assert(await inode.permission(ctx, uid, gid, Mode.READ), 'EACCES');

    return inode.list(ctx);
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    assert(isFile(handle.inode), 'EISDIR');
    const inode = new FileWrapper(handle.inode);

    const { uid, gid } = getCurrent(ctx);
    const perm = flag === PollFlag.READ ? Mode.READ : Mode.WRITE;
    assert(await inode.permission(ctx, uid, gid, perm), 'EACCES');

    return inode.poll(ctx, handle, flag, resolve);
  }

  async stat(ctx: ProcessContext, path: string): Promise<StatInfo> {
    const { inode } = await this.getInode_(ctx, path);
    return await inode.stat(ctx);
  }

  async chmod(ctx: ProcessContext, path: string, mode: number): Promise<void> {
    const { inode } = await this.getInode_(ctx, path);

    const { uid } = getCurrent(ctx);
    assert(uid === 0 || uid === inode.impl.uid, 'EPERM'); // not root or owner

    await inode.setAttr(ctx, { mode });
  }

  async chown(ctx: ProcessContext, path: string, uid: number, gid: number): Promise<void> {
    const { inode } = await this.getInode_(ctx, path);

    const { uid: currentUid } = getCurrent(ctx);
    assert(currentUid === 0, 'EPERM'); // only root can chown

    await inode.setAttr(ctx, { uid, gid });
  }

  async creat(ctx: ProcessContext, path: string, mode?: number): Promise<void> {
    await this.open(ctx, path, OpenFlags.CREAT | OpenFlags.WRITE | OpenFlags.TRUNC, mode);
  }

  async link(ctx: ProcessContext, target: string, source: string): Promise<void> {
    const { inode: srcInode } = await this.getInode_(ctx, source);
    const { parent: tgtParent, name: tgtName } = await this.getParent_(ctx, target);

    const { uid, gid } = getCurrent(ctx);
    assert(!isDirWrapper(srcInode), 'EISDIR');
    assert(await srcInode.permission(ctx, uid, gid, Mode.READ), 'EACCES');
    assert(await tgtParent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await tgtParent.link(ctx, tgtName, srcInode.impl);
  }

  async symlink(ctx: ProcessContext, target: string, source: string): Promise<void> {
    const { parent: tgtParent, name: tgtName } = await this.getParent_(ctx, target);

    const { uid, gid } = getCurrent(ctx);
    assert(await tgtParent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await tgtParent.symlink(ctx, tgtName, source);
  }


  async unlink(ctx: ProcessContext, path: string): Promise<void> {
    const { parent, name } = await this.getInode_(ctx, path, true);

    const { uid, gid } = getCurrent(ctx);
    assert(await parent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await parent.unlink(ctx, name);
  }

  async mkdir(ctx: ProcessContext, path: string, mode?: number): Promise<void> {
    const { parent, name } = await this.getParent_(ctx, path);

    const { uid, gid, umask } = getCurrent(ctx);
    assert(await parent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await parent.mkdir(ctx, name, mode ?? dirMask ^ umask);
  }

  async rmdir(ctx: ProcessContext, path: string): Promise<void> {
    const { parent, name } = await this.getParent_(ctx, path);

    const { uid, gid } = getCurrent(ctx);
    assert(await parent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await parent.rmdir(ctx, name);
  }

  async rename(ctx: ProcessContext, oldPath: string, newPath: string): Promise<void> {
    const { inode: oldInode, parent: oldParent, name: oldName } = await this.getInode_(ctx, oldPath);
    const { parent: newParent, name: newName } = await this.getParent_(ctx, newPath);

    const { uid, gid } = getCurrent(ctx);
    assert(await oldParent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');
    assert(await oldInode.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');
    assert(await newParent.permission(ctx, uid, gid, Mode.WRITE), 'EACCES');

    await newParent.link(ctx, newName, oldInode.impl);
    await oldParent.unlink(ctx, oldName);
  }

  async truncate(ctx: ProcessContext, path: string, length: number): Promise<void> {
    const { inode } = await this.getInode_(ctx, path);

    const { uid, gid } = getCurrent(ctx);
    assert(isFileWrapper(inode), 'EISDIR');
    assert(await inode.permission(ctx, uid, gid, Mode.WRITE));

    await inode.setAttr(ctx, { size: length });
  }

  async inode(ctx: ProcessContext, path: string): Promise<InodeWrapper> {
    const { inode } = await this.getInode_(ctx, path);
    return inode;
  }

  async chdir(ctx: ProcessContext, path: string): Promise<boolean> {
    const { inode } = await this.getInode_(ctx, path);
    const { uid, gid } = getCurrent(ctx);
    return isDirWrapper(inode) && await inode.permission(ctx, uid, gid, Mode.EXEC);
  }

  async mount(ctx: ProcessContext, path: string, inode: Inode): Promise<void> {
    const { parent, name } = await this.getParent_(ctx, path);

    const { uid, gid } = getCurrent(ctx);
    assert(await parent.permission(ctx, uid, gid, Mode.WRITE));
    assert(!await parent.lookup(ctx, name), 'EEXIST');
    inode.mount = true;

    await parent.link(ctx, name, inode);
  }

  async unmount(ctx: ProcessContext, path: string): Promise<void> {
    const { inode, parent, name } = await this.getInode_(ctx, path);

    const { uid, gid } = getCurrent(ctx);
    assert(await parent.permission(ctx, uid, gid, Mode.WRITE));
    assert(!await parent.lookup(ctx, name), 'EEXIST');
    assert(inode.impl.mount, 'ENOTMNT');
    inode.impl.mount = false;

    await parent.unlink(ctx, name);
  }
}
