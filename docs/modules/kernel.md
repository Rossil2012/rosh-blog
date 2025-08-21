# Kernel Module (`rosh/kernel/`)

The kernel module provides process management, system call interface, and core kernel functionality that enables the virtual shell system to execute commands and manage resources in a Unix-like manner.

## Module Overview

The kernel module consists of several key components:

- **Kernel Core** (`kernel.ts`) - Main kernel class with process scheduling and management
- **Process Definitions** (`def.ts`) - Process abstraction and system call interface
- **Kernel Builder** (`builder.ts`) - Factory for kernel initialization and configuration
- **System Calls** (`syscall/`) - Complete syscall layer for filesystem and process operations
- **PTY Support** (`ptmx.ts`) - Pseudo-terminal support for interactive sessions

## Architecture

### Process Management

The kernel implements a complete process management system:

```
Kernel
├── Process Scheduler
├── Process Table 
├── File Descriptor Management
├── System Call Interface
└── Inter-Process Communication
```

### Process Lifecycle

```
Creation → Ready → Running → Blocked/Ready → Zombie → Cleanup
```

## Core Components

### 1. Process Abstraction - `def.ts`

#### Process Class

The `Process` class is the fundamental unit of execution:

```typescript
export abstract class Process {
  static STATE = {
    RUNNING: Symbol('RUNNING'),
    READY: Symbol('READY'),
    BLOCKED: Symbol('BLOCKED'),
    STOPPED: Symbol('STOPPED'),
    ZOMBIE: Symbol('ZOMBIE')
  }

  kernel!: Kernel;
  pid!: number;
  pgid!: number;  // Process group ID
  parentPid!: number;
  state!: Symbol;
  fdtable!: FdTable;  // File descriptor table
  buf!: (Buffer | null)[];  // I/O buffers
  uid!: number;
  gid!: number[];
  umask!: number;
  env!: Record<string, string>;
  cwd!: string;
  retCode: number | undefined;

  abstract run(...args: any[]): Entrypoint;
}
```

#### Key Features:
- **State Management**: Complete process state transitions
- **File Descriptors**: Per-process file descriptor table
- **Process Groups**: Support for job control
- **Environment**: Per-process environment variables
- **Working Directory**: Current working directory tracking

#### System Call Interface

```typescript
export interface Syscall {
  exec(ctx: ProcessContext): Promise<unknown>;
}

export class FcnSyscall implements Syscall {
  private fcn_: AsyncFunction;
  private args_: any[];
  
  async exec(ctx: ProcessContext): Promise<unknown> {
    return this.fcn_(ctx, ...this.args_);
  }
}
```

### 2. Kernel Core - `kernel.ts`

The main kernel class manages the entire system:

#### Core Functionality:

```typescript
export class Kernel {
  private allProcs_: Array<Process | null>;
  private allProcGroups_: Map<number, Set<number>>;
  private readyChan_: Chan<ReadyRequest>;
  private vfs_: VFS;

  // Process management
  async spawn(cls: any, ...args: any[]): Promise<Process>;
  async kill(pid: number): Promise<void>;
  getProcess(pid: number): Process | null;
  getAllProcess(): Process[];

  // Scheduling
  schedule(): void;
  private async executeReady(proc: Process): Promise<void>;

  // System interface
  getVfs(): VFS;
  async newConnection(): Promise<RoshConnection>;
}
```

#### Process Scheduling

The kernel implements cooperative scheduling:

1. **Ready Queue**: Processes ready to execute
2. **Blocked Processes**: Waiting for I/O or other resources
3. **Event-Driven**: Processes yield control via system calls
4. **Async/Await**: Leverages JavaScript's async model

#### Example Process Execution:

```typescript
private async executeReady(proc: Process): Promise<void> {
  try {
    proc.state = Process.STATE.RUNNING;
    const syscall = (await proc.gen.next()).value;
    
    if (syscall) {
      const result = await syscall.exec({ proc });
      this.readyChan_.put({ proc, result });
    } else {
      // Process completed
      await proc.return(0);
    }
  } catch (error) {
    console.error('Process error:', error);
    await proc.return(1);
  }
}
```

### 3. Kernel Builder - `builder.ts`

Factory pattern for kernel initialization:

```typescript
export class KernelBuilder {
  private build_args_: KernelBuildArgs;
  private kernel_: Kernel;

  public static default(): KernelBuilder {
    return new KernelBuilder();
  }

  public withMount(path: string, inode: Inode): KernelBuilder {
    if (!this.build_args_.mnt_points) {
      this.build_args_.mnt_points = new Map();
    }
    this.build_args_.mnt_points.set(path, inode);
    return this;
  }

  public async build(): Promise<Kernel> {
    await this.kernel_.init(this.build_args_);
    this.kernel_.schedule();
    return this.kernel_;
  }

  public async buildWithConnection(): Promise<[Kernel, RoshConnection]> {
    const kernel = await this.build();
    const connection = await kernel.newConnection();
    return [kernel, connection];
  }
}
```

#### Usage Example:

```typescript
const kernel = await KernelBuilder
  .default()
  .withMount('/usr', binDir)
  .withMount('/proc', procDir)
  .build();
```

## System Call Layer (`syscall/`)

The syscall layer provides the interface between user-space commands and kernel operations:

### System Call Categories

#### 1. Filesystem Operations (`fs.ts`)

```typescript
// File operations
export const SysOpen = (path: string, flags: number) => new FcnSyscall(openImpl, path, flags);
export const SysRead = (fd: number, size: number) => new FcnSyscall(readImpl, fd, size);
export const SysWrite = (fd: number, data: Buffer) => new FcnSyscall(writeImpl, fd, data);
export const SysClose = (fd: number) => new FcnSyscall(closeImpl, fd);

// Directory operations
export const SysMkdir = (path: string, mode?: number) => new FcnSyscall(mkdirImpl, path, mode);
export const SysRmdir = (path: string) => new FcnSyscall(rmdirImpl, path);
export const SysGetdents = (fd: number) => new FcnSyscall(getdentsImpl, fd);

// Metadata operations
export const SysStat = (path: string) => new FcnSyscall(statImpl, path);
export const SysChmod = (path: string, mode: number) => new FcnSyscall(chmodImpl, path, mode);
```

#### 2. Process Operations (`fork.ts`)

```typescript
export const SysSpawn = (cls: any, ...args: any[]) => new FcnSyscall(spawnImpl, cls, ...args);
export const SysWait = (pid: number) => new FcnSyscall(waitImpl, pid);
export const SysKill = (pid: number) => new FcnSyscall(killImpl, pid);
export const SysGetpid = () => new FcnSyscall(getpidImpl);
```

#### 3. Environment Operations (`env.ts`)

```typescript
export const SysGetenv = (key: string) => new FcnSyscall(getenvImpl, key);
export const SysSetenv = (key: string, value: string) => new FcnSyscall(setenvImpl, key, value);
export const SysChdir = (path: string) => new FcnSyscall(chdirImpl, path);
export const SysGetcwd = () => new FcnSyscall(getcwdImpl);
```

#### 4. General Operations (`general.ts`)

```typescript
export const SysYield = () => new FcnSyscall(yieldImpl);
export const SysExit = (code: number) => new FcnSyscall(exitImpl, code);
```

### System Call Implementation Pattern

Each system call follows a consistent pattern:

```typescript
// Implementation function
export const openImpl = async (ctx: ProcessContext, path: string, flags: number): Promise<number> => {
  const { proc } = ctx;
  const vfs = getVfsFromCtx(ctx);
  const handle = await vfs.open(ctx, path.startsWith('/') ? path : `${proc.cwd}/${path}`, flags);
  const fd = allocFd(proc, handle);
  return fd;
}

// System call wrapper
export const SysOpen = (path: string, flags: number) => {
  return new FcnSyscall(openImpl, path, flags);
}
```

## Process Communication

### Pseudo-Terminal Support - `ptmx.ts`

Provides pseudo-terminal functionality for interactive sessions:

```typescript
export class PtmxFile extends File {
  private connection_: RoshConnection;

  constructor(connection: RoshConnection) {
    super({ mode: 0o666 });
    this.connection_ = connection;
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    return this.connection_.read(size);
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    this.connection_.write(data);
    return data.length;
  }
}
```

### Inter-Process Communication

The kernel supports various IPC mechanisms:

- **File Descriptors**: Shared file descriptors between processes
- **Process Groups**: Job control and signal delivery
- **Channels**: Go-like channels for async communication
- **Streams**: Stream-based I/O for command pipelines

## Usage Examples

### Creating and Running a Process

```typescript
// Define a simple process
class HelloProcess extends Process {
  async *run(message: string): Entrypoint {
    // Write to stdout (fd 1)
    yield SysWrite(1, Buffer.from(`Hello, ${message}!\n`));
    return 0;
  }
}

// Spawn the process
const kernel = await KernelBuilder.default().build();
const proc = await kernel.spawn(HelloProcess, "World");
const exitCode = await proc.wait();
```

### File Operations in a Process

```typescript
class FileProcess extends Process {
  async *run(filename: string): Entrypoint {
    // Open file for reading
    const fd = yield SysOpen(filename, OpenFlags.READ);
    
    // Read content
    const data = yield SysRead(fd, 1024);
    
    // Write to stdout
    yield SysWrite(1, data);
    
    // Close file
    yield SysClose(fd);
    
    return 0;
  }
}
```

### Directory Operations

```typescript
class LsProcess extends Process {
  async *run(path: string = '.'): Entrypoint {
    // Open directory
    const fd = yield SysOpen(path, OpenFlags.READ | OpenFlags.DIR);
    
    // List contents
    const files = yield SysGetdents(fd);
    
    // Output each file
    for (const file of files) {
      yield SysWrite(1, Buffer.from(file + '\n'));
    }
    
    // Close directory
    yield SysClose(fd);
    
    return 0;
  }
}
```

### Environment Management

```typescript
class EnvProcess extends Process {
  async *run(): Entrypoint {
    // Get environment variable
    const path = yield SysGetenv('PATH');
    
    // Set new environment variable
    yield SysSetenv('CUSTOM_VAR', 'custom_value');
    
    // Change directory
    yield SysChdir('/usr/bin');
    
    // Get current directory
    const cwd = yield SysGetcwd();
    
    yield SysWrite(1, Buffer.from(`Current directory: ${cwd}\n`));
    
    return 0;
  }
}
```

## Error Handling

The kernel provides robust error handling:

```typescript
try {
  const result = await syscall.exec({ proc });
  // Handle successful result
} catch (error) {
  // Handle syscall error
  console.error('System call failed:', error);
  await proc.return(1);
}
```

Common error patterns:
- **ENOENT**: File or directory not found
- **EACCES**: Permission denied
- **EAGAIN**: Resource temporarily unavailable
- **EINVAL**: Invalid argument

## Integration with Terminal

The kernel integrates with the terminal through the RoshConnection:

```typescript
export class RoshConnection {
  async read(size: number): Promise<Buffer>;
  write(data: Buffer): void;
  writeString(str: string): void;
  close(): void;
}
```

This enables:
- **Interactive Input**: Reading user commands from terminal
- **Output Display**: Writing command results to terminal
- **Real-time Communication**: Bidirectional data flow

## File References

- [`def.ts`](../files/kernel/def.md) - Process definitions and syscall interface
- [`kernel.ts`](../files/kernel/kernel.md) - Main kernel implementation
- [`builder.ts`](../files/kernel/builder.md) - Kernel factory and configuration
- [`ptmx.ts`](../files/kernel/ptmx.md) - Pseudo-terminal support
- [`syscall/fs.ts`](../files/kernel/syscall-fs.md) - Filesystem system calls
- [`syscall/fork.ts`](../files/kernel/syscall-fork.md) - Process management system calls
- [`syscall/env.ts`](../files/kernel/syscall-env.md) - Environment system calls
- [`syscall/general.ts`](../files/kernel/syscall-general.md) - General system calls

The kernel module provides a solid foundation for process execution and system resource management, enabling the virtual shell to behave like a real Unix-like system while maintaining the flexibility and safety of a JavaScript runtime environment.