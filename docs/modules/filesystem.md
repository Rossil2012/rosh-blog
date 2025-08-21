# Filesystem Module (`rosh/fs/`)

The filesystem module implements a complete virtual filesystem with Unix-like semantics, providing the foundation for file operations, directory management, and content access within the rosh shell system.

## Module Overview

The filesystem module is organized into several key components:

- **Core Definitions** (`def.ts`) - Base interfaces and classes for inodes, files, directories
- **Virtual File System** (`vfs.ts`) - Main filesystem interface with path resolution and operations
- **Core Filesystem** (`coreFs.ts`) - Concrete implementations of basic filesystem objects
- **Wrapper Classes** (`wrapper.ts`) - Decorators that add consistent behavior around core implementations
- **Specialized Filesystems** - Binary files (`binFs.ts`), process filesystem (`procFs.ts`), streams (`streamFs.ts`)

## Architecture

### Inode-Based Design

The filesystem follows Unix-like design principles with inodes as the fundamental building blocks:

```
Inode (base class)
├── File (regular files)
├── Dir (directories) 
└── Symlink (symbolic links)
```

Each inode contains:
- **Metadata**: Size, permissions, ownership, timestamps
- **Operations**: Open, read, write, stat, permission checking
- **Type-specific behavior**: File I/O, directory listing, symlink resolution

### Interface Hierarchy

```typescript
interface InodeMethod {
  open(ctx: ProcessContext, handle: FileHandle): Promise<void>;
  release(ctx: ProcessContext, handle: FileHandle): Promise<void>;
  stat(ctx: ProcessContext): Promise<StatInfo>;
  setAttr(ctx: ProcessContext, attr: AttrInfo): Promise<void>;
  permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean>;
}

interface FileMethod {
  read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>;
  write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>;
  poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean>;
}

interface DirMethod {
  list(ctx: ProcessContext): Promise<string[]>;
  lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined>;
  create(ctx: ProcessContext, name: string, mode: number): Promise<void>;
  mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void>;
  link(ctx: ProcessContext, name: string, source: Inode): Promise<void>;
  symlink(ctx: ProcessContext, name: string, source: string): Promise<void>;
  unlink(ctx: ProcessContext, name: string): Promise<Inode>;
  rmdir(ctx: ProcessContext, name: string): Promise<void>;
  rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void>;
}
```

## Core Components

### 1. Virtual File System (VFS) - `vfs.ts`

The VFS provides the main interface for all filesystem operations:

#### Key Features:
- **Path Resolution**: Converts paths to inodes with symlink handling
- **Permission Checking**: Unix-like permission validation
- **Mount Point Support**: Ability to mount different filesystems at paths
- **File Handle Management**: Manages open file descriptors and positions

#### Main Methods:

```typescript
// File Operations
async open(ctx: ProcessContext, path: string, flags: number, mode?: number): Promise<FileHandle>
async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>
async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>

// Directory Operations  
async mkdir(ctx: ProcessContext, path: string, mode?: number): Promise<void>
async rmdir(ctx: ProcessContext, path: string): Promise<void>
async list(ctx: ProcessContext, handle: FileHandle): Promise<string[]>

// Metadata Operations
async stat(ctx: ProcessContext, path: string): Promise<StatInfo>
async chmod(ctx: ProcessContext, path: string, mode: number): Promise<void>
async chown(ctx: ProcessContext, path: string, uid: number, gid: number): Promise<void>
```

### 2. Core Filesystem - `coreFs.ts`

Provides concrete implementations of basic filesystem objects:

#### CoreFile Class:
```typescript
export class CoreFile extends File {
  protected data_: Buffer;
  
  constructor(attr: Partial<InodeAttr>, data?: Buffer) {
    super(attr);
    this.data_ = data ?? Buffer.alloc(0);
    this.size = this.data_.length;
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
```

#### CoreDir Class:
```typescript
export class CoreDir extends Dir {
  protected children_: Map<string, Inode>;

  async list(ctx: ProcessContext): Promise<string[]> {
    return Array.from(this.children_.keys());
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    return this.children_.get(name);
  }

  async create(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    assert(!this.children_.has(name), 'EEXIST');
    const { uid, gid } = getCurrent(ctx);
    const file = new CoreFile({ uid, gid: gid[0], mode });
    this.children_.set(name, file);
  }
}
```

### 3. Wrapper Classes - `wrapper.ts`

Wrappers add consistent behavior around core implementations:

#### Features:
- **Timestamp Management**: Automatically updates access/modification times
- **Type Safety**: Provides type-safe interfaces for different inode types
- **Consistent API**: Unified interface across different filesystem implementations

#### Example:
```typescript
export class FileWrapper extends InodeWrapper implements FileMethod {
  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const ret = await this.impl.read(ctx, handle, size, offset);
    this.impl.atime = new Date(); // Update access time
    return ret;
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    const ret = await this.impl.write(ctx, handle, data, offset);
    const now = new Date();
    this.impl.mtime = new Date(now); // Update modification time
    this.impl.ctime = new Date(now); // Update change time
    return ret;
  }
}
```

## Specialized Filesystems

### Binary Filesystem - `binFs.ts`

Provides executable file support:

```typescript
export class BinFile extends File {
  private cls_: any;
  
  constructor(attr: Partial<InodeAttr>, cls: any) {
    super(attr);
    this.cls_ = cls;
  }
}
```

### Process Filesystem - `procFs.ts`

Implements `/proc` filesystem for system information:

```typescript
export class ProcDir extends Dir {
  async list(ctx: ProcessContext): Promise<string[]> {
    const kernel = ctx.proc.kernel;
    const allProcs = kernel.getAllProcess();
    return allProcs.map(proc => String(proc.pid)).concat(['self']);
  }
}
```

### Stream Filesystem - `streamFs.ts`

Handles stream-based I/O operations:

```typescript
export class StreamFile extends File {
  private stream_: Stream<any>;
  
  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    // Stream-based reading implementation
  }
}
```

## Usage Examples

### Creating a Virtual Filesystem

```typescript
import { VFS, CoreDir, CoreFile } from '@/rosh';

// Create VFS with root directory
const vfs = new VFS(new CoreDir({ mode: 0o755 }));

// Mount content at /home
const homeDir = new CoreDir({ mode: 0o755 });
await vfs.mount(ctx, '/home', homeDir);
```

### File Operations

```typescript
// Create a file
await vfs.creat(ctx, '/home/test.txt', 0o644);

// Open for writing
const handle = await vfs.open(ctx, '/home/test.txt', OpenFlags.WRITE);

// Write content
const data = Buffer.from('Hello, World!');
await vfs.write(ctx, handle, data, 0);

// Read content
const readHandle = await vfs.open(ctx, '/home/test.txt', OpenFlags.READ);
const content = await vfs.read(ctx, readHandle, 13, 0);
console.log(content.toString()); // "Hello, World!"
```

### Directory Operations

```typescript
// Create directory
await vfs.mkdir(ctx, '/home/documents', 0o755);

// List directory contents
const dirHandle = await vfs.open(ctx, '/home', OpenFlags.READ | OpenFlags.DIR);
const files = await vfs.list(ctx, dirHandle);
console.log(files); // ['test.txt', 'documents']
```

## File Permissions

The filesystem implements Unix-like permissions:

```typescript
// Permission constants
export const enum Mode {
  READ = 0x4,   // r--
  WRITE = 0x2,  // -w-
  EXEC = 0x1    // --x
}

// Permission checking
const hasPermission = await inode.permission(ctx, uid, gid, Mode.READ, Mode.WRITE);
```

## Error Handling

The filesystem uses Unix-like error codes:

- `ENOENT` - No such file or directory
- `EEXIST` - File exists
- `EACCES` - Permission denied
- `EISDIR` - Is a directory
- `ENOTDIR` - Not a directory
- `ELOOP` - Too many symbolic links

## Integration with Blog Content

The filesystem integrates with blog content through the Terminal component:

```typescript
class BlogDir extends CoreDir {
  public mountArticles(allArticles: Article[]) {
    for (const article of allArticles) {
      const path = article._raw.flattenedPath;
      const pathParts = resolvePath(path);
      const content = article.rawContent;
      this.mountInner(pathParts, content);
    }
  }
}
```

This allows blog articles to be accessed as files in the virtual filesystem, enabling commands like `cat article.md` to display blog content.

## File References

- [`def.ts`](../files/filesystem/def.md) - Core interfaces and base classes
- [`vfs.ts`](../files/filesystem/vfs.md) - Virtual filesystem implementation
- [`coreFs.ts`](../files/filesystem/coreFs.md) - Basic filesystem objects
- [`wrapper.ts`](../files/filesystem/wrapper.md) - Wrapper classes for consistent behavior
- [`binFs.ts`](../files/filesystem/binFs.md) - Binary/executable file support
- [`procFs.ts`](../files/filesystem/procFs.md) - Process filesystem implementation
- [`streamFs.ts`](../files/filesystem/streamFs.md) - Stream-based file operations

The filesystem module provides a robust foundation for the virtual shell system, enabling familiar Unix-like file operations while maintaining flexibility for specialized use cases like blog content integration.