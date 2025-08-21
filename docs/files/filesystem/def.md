# File Reference: `rosh/fs/def.ts`

## Overview

The `def.ts` file contains the core definitions and abstract base classes for the virtual filesystem. It defines the fundamental interfaces and types that all filesystem objects implement, establishing the contract for inodes, files, directories, and symbolic links.

## Key Components

### Types and Interfaces

#### FileHandle
```typescript
export type FileHandle = {
  inode: Inode;      // Reference to the inode
  pos: number;       // Current file position
  flags: OpenFlags;  // Open flags (read/write/etc)
  count: number;     // Reference count
};
```
Represents an open file descriptor with position tracking and access flags.

#### InodeAttr
```typescript
export type InodeAttr = {
  size: number;      // File size in bytes
  mode: number;      // Permission bits (Unix-style)
  uid: number;       // Owner user ID
  gid: number;       // Owner group ID
  atime: Date;       // Last access time
  mtime: Date;       // Last modification time
  ctime: Date;       // Creation/change time
  count: number;     // Hard link count
  mount: boolean;    // Is this a mount point?
};
```
Complete inode metadata structure following Unix filesystem conventions.

#### Mode Flags
```typescript
export const enum Mode {
  READ = 0x4,   // Read permission (r--)
  WRITE = 0x2,  // Write permission (-w-)
  EXEC = 0x1    // Execute permission (--x)
}
```
Permission bits for access control.

#### Open Flags
```typescript
export const enum OpenFlags {
  READ = 0x1,     // Open for reading
  WRITE = 0x2,    // Open for writing  
  CREAT = 0x4,    // Create if doesn't exist
  DIR = 0x8,      // Open as directory
  TRUNC = 0x10,   // Truncate on open
  APPEND = 0x20   // Append mode
}
```
File opening modes and options.

### Abstract Base Classes

#### Inode Class
```typescript
export class Inode implements InodeProto {
  // Metadata properties
  size!: number;
  mode!: number;
  uid!: number;
  gid!: number;
  atime!: Date;
  mtime!: Date;
  ctime!: Date;
  count!: number;
  mount!: boolean;

  constructor({ size, mode, uid, gid, count, atime, mtime, ctime, mount }: Partial<InodeAttr>) {
    // Initialize with defaults based on inode type
    this.size = size ?? 0;
    this.mode = mode ?? (isDir(this) ? dirMask : fileMask);
    this.uid = uid ?? 0;
    this.gid = gid ?? 0;
    this.count = count ?? 0;

    const now = new Date();
    this.atime = atime ?? new Date(now);
    this.mtime = mtime ?? new Date(now);
    this.ctime = ctime ?? new Date(now);
    this.mount = mount ?? false;
  }

  // Abstract methods implemented by subclasses
  async open(ctx: ProcessContext, handle: FileHandle): Promise<void> {}
  async release(ctx: ProcessContext, handle: FileHandle): Promise<void> {}
  async stat(ctx: ProcessContext): Promise<StatInfo> { /* implementation */ }
  async setAttr(ctx: ProcessContext, attr: AttrInfo): Promise<void> { /* implementation */ }
  async permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean> { /* implementation */ }
}
```

#### File Class
```typescript
export class File extends Inode implements FileProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  // File-specific operations (must be implemented by subclasses)
  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    throw new Error('EOPNOTSUPP');
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    throw new Error('EOPNOTSUPP');
  }

  async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean> {
    throw new Error('EOPNOTSUPP');
  }
}
```

#### Dir Class
```typescript
export class Dir extends Inode implements DirProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  // Directory-specific operations (must be implemented by subclasses)
  async list(ctx: ProcessContext): Promise<string[]> {
    throw new Error('EOPNOTSUPP');
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    throw new Error('EOPNOTSUPP');
  }

  async create(ctx: ProcessContext, name: string, mode: number): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void> {
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

  async rmdir(ctx: ProcessContext, name: string): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }

  async rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void> {
    throw new Error('EOPNOTSUPP');
  }
}
```

#### Symlink Class
```typescript
export class Symlink extends Inode implements SymlinkProto {
  constructor(attr: Partial<InodeAttr>) {
    super(attr);
  }

  async readlink(ctx: ProcessContext): Promise<string> {
    throw new Error('EOPNOTSUPP');
  }
}
```

### Type Guards

```typescript
export const isFile = (inode: Inode): inode is File => {
  return inode instanceof File;
}

export const isDir = (inode: Inode): inode is Dir => {
  return inode instanceof Dir;
}

export const isSymlink = (inode: Inode): inode is Symlink => {
  return inode instanceof Symlink;
}
```

## Usage Patterns

### Creating Custom Inodes

```typescript
// Custom file type
class MyCustomFile extends File {
  private data: string;

  constructor(data: string, attr: Partial<InodeAttr> = {}) {
    super(attr);
    this.data = data;
    this.size = Buffer.byteLength(data);
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const buffer = Buffer.from(this.data);
    return buffer.slice(offset, offset + size);
  }
}

// Custom directory type
class MyCustomDir extends Dir {
  private entries: Map<string, Inode> = new Map();

  async list(ctx: ProcessContext): Promise<string[]> {
    return Array.from(this.entries.keys());
  }

  async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined> {
    return this.entries.get(name);
  }
}
```

### Permission Checking

```typescript
// Check if user can read a file
const canRead = await inode.permission(ctx, uid, gid, Mode.READ);

// Check multiple permissions
const canReadWrite = await inode.permission(ctx, uid, gid, Mode.READ, Mode.WRITE);
```

### Metadata Operations

```typescript
// Get file statistics
const stats = await inode.stat(ctx);
console.log(`Size: ${stats.size}, Mode: ${stats.mode.toString(8)}`);

// Update file attributes
await inode.setAttr(ctx, {
  mode: 0o644,
  uid: 1000,
  gid: 1000
});
```

## Design Principles

### Interface Segregation
The file separates concerns by defining specific interfaces for different inode types:
- `InodeMethod` - Core operations for all inodes
- `FileMethod` - File-specific operations  
- `DirMethod` - Directory-specific operations
- `SymlinkMethod` - Symlink-specific operations

### Template Method Pattern
Base classes provide common functionality while requiring subclasses to implement specific behavior:
- Constructor handles common initialization
- Abstract methods enforce interface compliance
- Default implementations throw appropriate errors

### Type Safety
Strong TypeScript typing ensures:
- Compile-time checking of operations
- Runtime type guards for safe casting
- Clear contracts between components

## Integration Points

### With VFS Layer
The VFS uses these base classes through the wrapper pattern to add consistent behavior like timestamp updates.

### With Kernel Layer
Process contexts flow through all operations, enabling:
- Permission checking based on process credentials
- Resource tracking per process
- Consistent error handling

### With Built-in Commands
Commands interact with inodes through these well-defined interfaces, enabling generic file operations across different inode types.

## Constants and Utilities

```typescript
// Default permission masks
export const fileMask = 0o666;  // Default file permissions
export const dirMask = 0o777;   // Default directory permissions

// Poll flags for async I/O
export const enum PollFlag {
  READ,    // Poll for read readiness
  WRITE    // Poll for write readiness
}
```

This file establishes the foundation for the entire virtual filesystem, providing the interfaces and base implementations that enable a Unix-like file system experience within the JavaScript runtime.