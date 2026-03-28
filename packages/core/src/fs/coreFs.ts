import { Inode, File, Dir, Symlink, InodeAttr, AttrInfo, isDir, getCurrent, FileHandle, ProcessContext, assert } from '../internal';
import { Buffer } from "buffer";


export class CoreFile extends File {
  private data_: Buffer;

  constructor(attr: Partial<InodeAttr>, data?: Buffer) {
    attr.size = data?.length ?? 0;
    super(attr);
    this.data_ = data ?? Buffer.alloc(0);
  }

  async setAttr(ctx: ProcessContext, attr: Partial<AttrInfo>): Promise<void> {
    if (attr.size) {
      if (attr.size < this.data_.length) {
        this.data_ = this.data_.slice(0, attr.size);
      } else if (attr.size > this.data_.length) {
        const additionalData = Buffer.alloc(attr.size - this.data_.length);
        this.data_ = Buffer.concat([this.data_, additionalData]);
      }
    }
    super.setAttr(ctx, attr);
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    return this.data_.slice(offset, offset + size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    this.data_ = Buffer.concat([this.data_.slice(0, offset), data, this.data_.slice(offset + data.length)]);
    this.size = this.data_.length;
    return data.length;
  }
}

export class CoreDir extends Dir {
  protected children_: Map<string, Inode>;

  constructor(attr: Partial<InodeAttr>, children?: Map<string, Inode>) {
    super(attr);
    this.children_ = children ?? new Map();
  }

  async list(ctx: ProcessContext): Promise<string[]> {
    return Array.from(this.children_.keys());
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    return this.children_.get(name);
  }

  async rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void> {
    const inode = this.children_.get(oldName);
    assert(inode, 'ENOENT');
    assert(!this.children_.has(newName), 'EEXIST');
    this.children_.set(newName, inode);
    this.children_.delete(oldName);
  }

  async create(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    assert(!this.children_.has(name), 'EEXIST');
    const { uid, gid } = getCurrent(ctx);
    const file = new CoreFile({ uid, gid: gid[0], mode });
    this.children_.set(name, file);
  }

  async link(ctx: ProcessContext, name: string, source: Inode): Promise<void> {
    assert(!this.children_.has(name), 'EEXIST');
    source.count++;
    this.children_.set(name, source);
  }

  async symlink(ctx: ProcessContext, name: string, source: string): Promise<void> {
    assert(!this.children_.has(name), 'EEXIST');
    const { uid, gid } = getCurrent(ctx);
    const symlink = new CoreSymlink(source, { uid, gid: gid[0] })
    this.children_.set(name, symlink);
  }

  async unlink(ctx: ProcessContext, name: string): Promise<Inode> {
    const inode = this.children_.get(name);
    assert(inode, 'ENOENT');
    assert(!isDir(inode), 'EISDIR');
    if (--inode.count <= 0) {
      this.children_.delete(name);
    }
    return inode;
  }

  async mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    assert(!this.children_.has(name), 'EEXIST');
    const { uid, gid } = getCurrent(ctx);
    const dir = new CoreDir({ uid, gid: gid[0], mode });
    this.children_.set(name, dir);
  }

  async rmdir(ctx: ProcessContext, name: string): Promise<void> {
    const inode = this.children_.get(name);
    assert(inode, 'ENOENT');
    assert(isDir(inode), 'ENOTDIR');
    assert(this.children_.delete(name));
  }
}

export class CoreSymlink extends Symlink {
  private target_: string;
  constructor(target: string, attr: Partial<InodeAttr>) {
    super(attr);
    this.target_ = target;
  }

  async readlink(ctx: ProcessContext): Promise<string> {
    return this.target_;
  }
}
