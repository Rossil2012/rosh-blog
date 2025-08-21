# API Reference

This document provides a complete API reference for the Rosh Blog virtual shell system. All APIs are organized by module and include TypeScript signatures, parameter descriptions, and usage examples.

## Table of Contents

- [Filesystem API](#filesystem-api)
- [Kernel API](#kernel-api)
- [Process API](#process-api)
- [System Calls API](#system-calls-api)
- [Library API](#library-api)
- [React Components API](#react-components-api)

## Filesystem API

### VFS (Virtual File System)

The main interface for all filesystem operations.

#### Constructor
```typescript
constructor(root?: Dir)
```
Creates a new VFS instance with optional root directory.

**Parameters:**
- `root?: Dir` - Root directory (defaults to empty CoreDir)

**Example:**
```typescript
const vfs = new VFS(new CoreDir({ mode: 0o755 }));
```

#### File Operations

##### open()
```typescript
async open(ctx: ProcessContext, path: string, flags: number, mode?: number): Promise<FileHandle>
```
Opens a file or directory.

**Parameters:**
- `ctx: ProcessContext` - Process context
- `path: string` - File path (absolute or relative)
- `flags: number` - Open flags (OpenFlags enum)
- `mode?: number` - Creation mode (if CREAT flag is set)

**Returns:** `Promise<FileHandle>` - File handle for subsequent operations

**Throws:**
- `ENOENT` - File not found
- `EACCES` - Permission denied
- `EISDIR` - Is a directory (when expecting file)
- `ENOTDIR` - Not a directory (when expecting directory)

**Example:**
```typescript
const handle = await vfs.open(ctx, '/etc/passwd', OpenFlags.READ);
```

##### read()
```typescript
async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>
```
Reads data from an open file.

**Parameters:**
- `ctx: ProcessContext` - Process context
- `handle: FileHandle` - Open file handle
- `size: number` - Number of bytes to read
- `offset: number` - File offset to read from

**Returns:** `Promise<Buffer>` - Data read from file

**Example:**
```typescript
const data = await vfs.read(ctx, handle, 1024, 0);
console.log(data.toString());
```

##### write()
```typescript
async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>
```
Writes data to an open file.

**Parameters:**
- `ctx: ProcessContext` - Process context
- `handle: FileHandle` - Open file handle
- `data: Buffer` - Data to write
- `offset: number` - File offset to write at

**Returns:** `Promise<number>` - Number of bytes written

**Example:**
```typescript
const written = await vfs.write(ctx, handle, Buffer.from("Hello"), 0);
```

#### Directory Operations

##### mkdir()
```typescript
async mkdir(ctx: ProcessContext, path: string, mode?: number): Promise<void>
```
Creates a directory.

**Parameters:**
- `path: string` - Directory path
- `mode?: number` - Directory permissions (default: 0o755)

**Example:**
```typescript
await vfs.mkdir(ctx, '/home/user/documents', 0o755);
```

##### rmdir()
```typescript
async rmdir(ctx: ProcessContext, path: string): Promise<void>
```
Removes an empty directory.

##### list()
```typescript
async list(ctx: ProcessContext, handle: FileHandle): Promise<string[]>
```
Lists directory contents.

**Returns:** `Promise<string[]>` - Array of file/directory names

#### Metadata Operations

##### stat()
```typescript
async stat(ctx: ProcessContext, path: string): Promise<StatInfo>
```
Gets file/directory statistics.

**Returns:** `Promise<StatInfo>` - File metadata

```typescript
interface StatInfo extends InodeAttr {
  type: 'file' | 'dir' | 'symlink';
}
```

##### chmod()
```typescript
async chmod(ctx: ProcessContext, path: string, mode: number): Promise<void>
```
Changes file permissions.

##### chown()
```typescript
async chown(ctx: ProcessContext, path: string, uid: number, gid: number): Promise<void>
```
Changes file ownership.

### Inode Classes

#### Inode (Abstract Base)

##### Constructor
```typescript
constructor(attr: Partial<InodeAttr>)
```

##### Methods
```typescript
async open(ctx: ProcessContext, handle: FileHandle): Promise<void>
async release(ctx: ProcessContext, handle: FileHandle): Promise<void>
async stat(ctx: ProcessContext): Promise<StatInfo>
async setAttr(ctx: ProcessContext, attr: AttrInfo): Promise<void>
async permission(ctx: ProcessContext, uid: number, gid: number[], ...perms: number[]): Promise<boolean>
```

#### File Class

Extends Inode for regular files.

```typescript
async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer>
async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number>
async poll(ctx: ProcessContext, handle: FileHandle, flag: PollFlag, resolve: () => void): Promise<boolean>
```

#### Dir Class

Extends Inode for directories.

```typescript
async list(ctx: ProcessContext): Promise<string[]>
async lookup(ctx: ProcessContext, name: string): Promise<Inode | undefined>
async create(ctx: ProcessContext, name: string, mode: number): Promise<void>
async mkdir(ctx: ProcessContext, name: string, mode: number): Promise<void>
async link(ctx: ProcessContext, name: string, source: Inode): Promise<void>
async symlink(ctx: ProcessContext, name: string, source: string): Promise<void>
async unlink(ctx: ProcessContext, name: string): Promise<Inode>
async rmdir(ctx: ProcessContext, name: string): Promise<void>
async rename(ctx: ProcessContext, oldName: string, newName: string): Promise<void>
```

## Kernel API

### Kernel Class

Main kernel for process management.

#### Constructor
```typescript
constructor()
```

#### Process Management

##### spawn()
```typescript
async spawn(cls: ProcessClass, ...args: any[]): Promise<Process>
```
Creates and starts a new process.

**Parameters:**
- `cls: ProcessClass` - Process class constructor
- `...args: any[]` - Arguments to pass to process

**Returns:** `Promise<Process>` - New process instance

**Example:**
```typescript
const proc = await kernel.spawn(EchoProcess, "Hello", "World");
const exitCode = await proc.wait();
```

##### kill()
```typescript
async kill(pid: number): Promise<void>
```
Terminates a process.

##### getProcess()
```typescript
getProcess(pid: number): Process | null
```
Gets process by PID.

##### getAllProcess()
```typescript
getAllProcess(): Process[]
```
Gets all active processes.

#### System Interface

##### getVfs()
```typescript
getVfs(): VFS
```
Gets the virtual filesystem instance.

##### newConnection()
```typescript
async newConnection(): Promise<RoshConnection>
```
Creates a new terminal connection.

### KernelBuilder Class

Factory for kernel configuration.

#### Static Methods

##### default()
```typescript
static default(): KernelBuilder
```
Creates a new builder with default configuration.

#### Instance Methods

##### withMount()
```typescript
withMount(path: string, inode: Inode): KernelBuilder
```
Adds a filesystem mount point.

**Example:**
```typescript
const kernel = await KernelBuilder
  .default()
  .withMount('/proc', new ProcDir())
  .withMount('/blog', blogDir)
  .build();
```

##### build()
```typescript
async build(): Promise<Kernel>
```
Builds and initializes the kernel.

##### buildWithConnection()
```typescript
async buildWithConnection(): Promise<[Kernel, RoshConnection]>
```
Builds kernel and creates a connection.

## Process API

### Process Class (Abstract)

Base class for all processes.

#### Properties
```typescript
kernel: Kernel;           // Kernel instance
pid: number;              // Process ID
pgid: number;             // Process group ID
parentPid: number;        // Parent process ID
state: Symbol;            // Process state
fdtable: FdTable;         // File descriptor table
buf: (Buffer | null)[];   // I/O buffers
uid: number;              // User ID
gid: number[];            // Group IDs
umask: number;            // File creation mask
env: Record<string, string>; // Environment variables
cwd: string;              // Current working directory
```

#### Methods

##### run() (Abstract)
```typescript
abstract run(...args: any[]): AsyncGenerator<Syscall, number, unknown>
```
Main process execution function.

**Returns:** `AsyncGenerator` that yields syscalls and returns exit code

##### wait()
```typescript
async wait(): Promise<number>
```
Waits for process completion.

**Returns:** `Promise<number>` - Exit code

##### return()
```typescript
async return(retCode: number): Promise<void>
```
Terminates process with exit code.

#### Process States
```typescript
static STATE = {
  RUNNING: Symbol('RUNNING'),
  READY: Symbol('READY'),
  BLOCKED: Symbol('BLOCKED'),
  STOPPED: Symbol('STOPPED'),
  ZOMBIE: Symbol('ZOMBIE')
}
```

### Implementing a Process

```typescript
export class MyCommand extends Process {
  async *run(arg1: string, arg2: number): AsyncGenerator<Syscall, number, unknown> {
    // Validate arguments
    if (!arg1) {
      yield SysWriteAll(stderr, Buffer.from("Missing argument\n"));
      return 1;
    }

    // Perform operations
    const fd = yield SysOpen('/etc/config', OpenFlags.READ) as number;
    const data = yield SysRead(fd, 1024) as Buffer;
    yield SysClose(fd);

    // Output results
    yield SysWriteAll(stdout, data);
    
    return 0; // Success
  }
}
```

## System Calls API

All system calls follow the pattern: `Sys<Name>(...args) => FcnSyscall`

### File System Calls

#### SysOpen
```typescript
SysOpen(path: string, flags: number): FcnSyscall
```

#### SysRead
```typescript
SysRead(fd: number, size: number): FcnSyscall
```

#### SysWrite
```typescript
SysWrite(fd: number, data: Buffer): FcnSyscall
```

#### SysClose
```typescript
SysClose(fd: number): FcnSyscall
```

#### SysGetdents
```typescript
SysGetdents(fd: number): FcnSyscall
```

#### SysStat
```typescript
SysStat(path: string): FcnSyscall
```

### Process System Calls

#### SysSpawn
```typescript
SysSpawn(cls: ProcessClass, ...args: any[]): FcnSyscall
```

#### SysWait
```typescript
SysWait(pid: number): FcnSyscall
```

#### SysExit
```typescript
SysExit(code: number): FcnSyscall
```

#### SysGetpid
```typescript
SysGetpid(): FcnSyscall
```

### Environment System Calls

#### SysGetenv
```typescript
SysGetenv(key: string): FcnSyscall
```

#### SysSetenv
```typescript
SysSetenv(key: string, value: string): FcnSyscall
```

#### SysGetcwd
```typescript
SysGetcwd(): FcnSyscall
```

#### SysChdir
```typescript
SysChdir(path: string): FcnSyscall
```

### Usage in Processes

```typescript
export class FileReader extends Process {
  async *run(filename: string): AsyncGenerator<Syscall, number, unknown> {
    // All syscalls are yielded, not awaited
    const fd = yield SysOpen(filename, OpenFlags.READ) as number;
    const data = yield SysRead(fd, 1024) as Buffer;
    yield SysClose(fd);
    
    yield SysWriteAll(stdout, data);
    return 0;
  }
}
```

## Library API

### Chan<T> Class

Go-like channels for async communication.

#### Constructor
```typescript
constructor(bufferSize?: number)
```

#### Methods

##### put()
```typescript
async put(item: T): Promise<typeof Chan.CLOSED | typeof Chan.SUCCESS>
```

##### get()
```typescript
async get(): Promise<T | typeof Chan.CLOSED>
```

##### tryPut()
```typescript
tryPut(item: T): typeof Chan.CLOSED | typeof Chan.SUCCESS | typeof Chan.FAILED
```

##### tryGet()
```typescript
tryGet(): T | typeof Chan.CLOSED | typeof Chan.FAILED
```

##### close()
```typescript
close(): void
```

### Stream Class

Buffer-based stream processing.

#### Constructor
```typescript
constructor(bufferSize?: number)
```

#### Methods

##### read()
```typescript
async read(size: number): Promise<Buffer>
```

##### write()
```typescript
async write(data: Buffer): Promise<number>
```

##### poll()
```typescript
async poll(flag: PollFlag, resolve: () => void): Promise<boolean>
```

### Helper Functions

#### assert()
```typescript
function assert(condition: any, message?: string): asserts condition
```

#### resolvePath()
```typescript
function resolvePath(path: string): string[]
```

#### checkBitFlags()
```typescript
function checkBitFlags(flags: number, ...toCheck: number[]): boolean
```

## React Components API

### Terminal Component

#### Props
```typescript
interface TerminalProps {
  // No props - self-contained component
}
```

#### Usage
```typescript
import Terminal from '@/components/Terminal';

function App() {
  return <Terminal />;
}
```

### MDX Component

#### Props
```typescript
interface MDXProps {
  code: string; // Compiled MDX code
}
```

#### Usage
```typescript
import MDX from '@/components/MDX';

function Article({ article }) {
  return <MDX code={article.body.code} />;
}
```

## Error Handling

### Error Codes

The system uses Unix-like error codes:

```typescript
// Common error codes
'ENOENT'   // No such file or directory
'EEXIST'   // File exists
'EACCES'   // Permission denied
'EISDIR'   // Is a directory
'ENOTDIR'  // Not a directory
'EINVAL'   // Invalid argument
'ELOOP'    // Too many symbolic links
'EAGAIN'   // Resource temporarily unavailable
```

### Error Handling Patterns

```typescript
// In processes
try {
  const fd = yield SysOpen(path, OpenFlags.READ) as number;
  // ... operations
  yield SysClose(fd);
} catch (error) {
  yield SysWriteAll(stderr, Buffer.from(`Error: ${error.message}\n`));
  return 1;
}

// In async functions
try {
  const result = await vfs.operation();
} catch (error) {
  if (error.message === 'ENOENT') {
    // Handle file not found
  }
  throw error;
}
```

This API reference provides the complete interface for working with the Rosh Blog virtual shell system. For more detailed examples and usage patterns, see the individual module documentation.