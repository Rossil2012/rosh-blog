# Library Utilities Module (`rosh/lib/`)

The library utilities module provides core abstractions and helper functions that support the virtual shell system. It includes Go-like channels for async communication, stream processing capabilities, and various utility functions used throughout the system.

## Module Overview

The library module consists of three main components:

- **Channels** (`chan.ts`) - Go-like channels for async communication between processes
- **Streams** (`stream.ts`) - Buffer-based stream processing for I/O operations  
- **Helper Functions** (`helper.ts`) - Common utilities for path resolution, array manipulation, and system operations

## Architecture

### Async Communication Model

The library provides building blocks for async operations:

```
Channels ← → Streams ← → Helper Functions
    ↑           ↑            ↑
Process IPC   I/O Ops    Path/Data Utils
```

### Design Principles

- **Non-blocking Operations**: All operations support async/await patterns
- **Backpressure Handling**: Built-in flow control for data streams
- **Type Safety**: Strong TypeScript typing throughout
- **Resource Management**: Proper cleanup and lifecycle management

## Core Components

### 1. Channels (`chan.ts`)

Go-like channels for communicating between async processes:

#### Channel Class

```typescript
export class Chan<T> {
  private queue_: T[];
  private bufferSize_: number;
  private pendingGets_: Array<(item: T | typeof Chan.CLOSED) => void>;
  private pendingPuts_: Array<{item: T, resolve: (value: typeof Chan.CLOSED | typeof Chan.SUCCESS) => void}>;
  private isClosed_: boolean;

  static CLOSED = Symbol('CLOSED');
  static SUCCESS = Symbol('SUCCESS');
  static FAILED = Symbol('FAILED');

  constructor(bufferSize?: number);
  async put(item: T): Promise<typeof Chan.CLOSED | typeof Chan.SUCCESS>;
  async get(): Promise<T | typeof Chan.CLOSED>;
  tryPut(item: T): typeof Chan.CLOSED | typeof Chan.SUCCESS | typeof Chan.FAILED;
  tryGet(): T | typeof Chan.CLOSED | typeof Chan.FAILED;
  close(): void;
  isClosed(): boolean;
}
```

#### Features

**Buffered Channels:**
```typescript
const chan = new Chan<string>(10); // Buffer size of 10
await chan.put("hello");           // Non-blocking if buffer has space
const message = await chan.get();  // Non-blocking if buffer has data
```

**Unbuffered Channels:**
```typescript
const chan = new Chan<number>();   // Infinite buffer (effectively unbuffered)
```

**Non-blocking Operations:**
```typescript
const result = chan.tryPut(data);
if (result === Chan.SUCCESS) {
  console.log("Data sent successfully");
} else if (result === Chan.FAILED) {
  console.log("Channel full, try again later");
}
```

**Channel Lifecycle:**
```typescript
// Close channel to signal completion
chan.close();

// Check if channel is closed
if (chan.isClosed()) {
  console.log("Channel closed");
}

// Get returns CLOSED after channel is closed and empty
const result = await chan.get();
if (result === Chan.CLOSED) {
  console.log("No more data");
}
```

#### Usage Examples

**Producer-Consumer Pattern:**
```typescript
const dataChan = new Chan<string>(5);

// Producer
async function producer() {
  for (let i = 0; i < 10; i++) {
    const result = await dataChan.put(`item-${i}`);
    if (result === Chan.CLOSED) break;
  }
  dataChan.close();
}

// Consumer  
async function consumer() {
  while (true) {
    const item = await dataChan.get();
    if (item === Chan.CLOSED) break;
    console.log(`Processed: ${item}`);
  }
}
```

**Fan-out Pattern:**
```typescript
const inputChan = new Chan<number>();
const output1 = new Chan<number>();
const output2 = new Chan<number>();

async function fanOut() {
  while (true) {
    const data = await inputChan.get();
    if (data === Chan.CLOSED) break;
    
    await Promise.all([
      output1.put(data),
      output2.put(data)
    ]);
  }
  output1.close();
  output2.close();
}
```

### 2. Streams (`stream.ts`)

Buffer-based stream processing for I/O operations:

#### Stream Class

```typescript
export class Stream {
  private buffer_: Buffer;
  private bufferSize_: number;
  private pendingReads_: Array<{ size: number, resolve: (buffer: Buffer) => void }>;
  private pendingWrites_: Array<{ data: Buffer, resolve: (written: number) => void }>;
  private pendingReadPolls_: Array<{ resolve: () => void }>;
  private pendingWritePolls_: Array<{ resolve: () => void }>;
  private isClosed_: boolean;

  constructor(bufferSize?: number);
  async read(size: number): Promise<Buffer>;
  async write(data: Buffer): Promise<number>;
  async poll(flag: PollFlag, resolve: () => void): Promise<boolean>;
  close(): void;
  isClosed(): boolean;
}
```

#### Features

**Buffered I/O:**
```typescript
const stream = new Stream(1024); // 1KB buffer

// Write data (may block if buffer full)
const written = await stream.write(Buffer.from("Hello, World!"));

// Read data (may block if buffer empty)
const data = await stream.read(13);
console.log(data.toString()); // "Hello, World!"
```

**Backpressure Handling:**
```typescript
// Writer blocks when buffer is full
const largeData = Buffer.alloc(2048);
const written = await stream.write(largeData); // May write partial data

// Reader unblocks waiting writers
const chunk = await stream.read(1024); // Frees up buffer space
```

**Polling for Readiness:**
```typescript
// Check if stream is ready for reading
const readReady = await stream.poll(PollFlag.READ, () => {
  console.log("Stream ready for reading");
});

// Check if stream is ready for writing  
const writeReady = await stream.poll(PollFlag.WRITE, () => {
  console.log("Stream ready for writing");
});
```

#### Usage Examples

**Pipe Implementation:**
```typescript
async function pipe(input: Stream, output: Stream) {
  try {
    while (!input.isClosed()) {
      const data = await input.read(1024);
      if (data.length === 0) break;
      
      await output.write(data);
    }
  } finally {
    output.close();
  }
}
```

**Text Line Processing:**
```typescript
class LineProcessor {
  private stream: Stream;
  private lineBuffer: string = '';

  constructor(stream: Stream) {
    this.stream = stream;
  }

  async *readLines(): AsyncGenerator<string> {
    while (!this.stream.isClosed()) {
      const chunk = await this.stream.read(256);
      if (chunk.length === 0) break;
      
      this.lineBuffer += chunk.toString();
      
      let newlineIndex;
      while ((newlineIndex = this.lineBuffer.indexOf('\n')) !== -1) {
        const line = this.lineBuffer.slice(0, newlineIndex);
        this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
        yield line;
      }
    }
    
    // Yield remaining buffer as last line
    if (this.lineBuffer.length > 0) {
      yield this.lineBuffer;
    }
  }
}
```

### 3. Helper Functions (`helper.ts`)

Essential utility functions used throughout the system:

#### Core Utilities

**Assertion Functions:**
```typescript
export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed.");
  }
}

// Usage
assert(fd >= 0, "Invalid file descriptor");
assert(data.length > 0, "Empty data buffer");
```

**Array Utilities:**
```typescript
export const findOrPushNullEntry = (arr: Array<any | null>): number => {
  // Find first null slot or add new entry
  for (let [idx, entry] of arr.entries()) {
    if (entry === null) return idx;
  }
  arr.push(null);
  return arr.length - 1;
};

export const makeSequence = (start: number, end: number): number[] => {
  // Generate number sequence
  if (start < end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    return Array.from({ length: start - end + 1 }, (_, i) => start - i);
  }
};

// Usage
const fds = [handle1, null, handle3];
const newFd = findOrPushNullEntry(fds); // Returns 1 (null slot)

const numbers = makeSequence(1, 5); // [1, 2, 3, 4, 5]
```

**Object Utilities:**
```typescript
export const shallowCopy = (obj: any): any => ({ ...obj });

export const createDefaultRecord = <K extends PropertyKey, V>(
  defaultValue: V | (() => V), 
  init?: Record<K, V>
): Record<K, V> => {
  // Create record with default value for missing keys
  const baseRecord = shallowCopy(init ?? {});
  return new Proxy(baseRecord as Record<K, V>, {
    get: function(target: Record<K, V>, property: PropertyKey) {
      if (!Reflect.has(target, property)) {
        target[property as K] = typeof defaultValue === 'function' 
          ? (defaultValue as () => V)() 
          : defaultValue;
      }
      return target[property as K];
    }
  });
};

// Usage
const envVars = createDefaultRecord<string, string>('', {
  PATH: '/usr/bin:/bin',
  HOME: '/home/user'
});
console.log(envVars.SHELL); // '' (default value)
```

#### Path and File System Utilities

**Path Resolution:**
```typescript
export const resolvePath = (path: string): string[] => {
  // Resolve . and .. in paths
  let resolved: string[] = [];
  const parts = path.split('/').filter(part => part !== '');
  for (const part of parts) {
    if (part === ".") {
      continue;
    } else if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved;
};

// Usage
const parts = resolvePath("/home/user/../documents/./file.txt");
// Returns: ["home", "documents", "file.txt"]
```

**Executable Path Resolution:**
```typescript
export const getAbsPath = (path: string, cwd: string, envPath?: string): string[] => {
  // Resolve command paths considering PATH environment
  if (path.includes('/')) {
    return path.startsWith('/') ? [path] : [`${cwd}/${path}`];
  }

  const resolved = [];
  if (envPath) {
    for (const dir of envPath.split(':')) {
      resolved.push(`${dir}/${path}`);
    }
  }
  return resolved;
};

// Usage
const paths = getAbsPath('ls', '/home/user', '/usr/bin:/bin');
// Returns: ["/usr/bin/ls", "/bin/ls"]
```

#### Bit Flag Operations

```typescript
export const checkBitFlags = (flags: number, ...toCheck: number[]): boolean => {
  // Check if all specified flags are set
  for (const flag of toCheck) {
    if (!(flag & flags)) {
      return false;
    }
  }
  return true;
};

// Usage
const flags = OpenFlags.READ | OpenFlags.WRITE;
const canReadWrite = checkBitFlags(flags, OpenFlags.READ, OpenFlags.WRITE); // true
const canExec = checkBitFlags(flags, OpenFlags.EXEC); // false
```

#### Async Utilities

```typescript
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const unreachable = (): never => {
  throw new Error('never reach');
};

// Usage
await sleep(1000); // Wait 1 second

// In switch statements for exhaustiveness checking
switch (type) {
  case 'file': return handleFile();
  case 'dir': return handleDir();
  default: unreachable(); // TypeScript ensures all cases handled
}
```

## Integration Patterns

### Channel-Stream Bridge

```typescript
async function channelToStream<T>(chan: Chan<T>, stream: Stream) {
  while (true) {
    const item = await chan.get();
    if (item === Chan.CLOSED) break;
    
    const data = Buffer.from(JSON.stringify(item));
    await stream.write(data);
  }
  stream.close();
}

async function streamToChannel(stream: Stream, chan: Chan<Buffer>) {
  while (!stream.isClosed()) {
    const data = await stream.read(1024);
    if (data.length === 0) break;
    
    const result = await chan.put(data);
    if (result === Chan.CLOSED) break;
  }
  chan.close();
}
```

### Process Communication

```typescript
class ProcessPipe {
  private inputChan: Chan<Buffer>;
  private outputStream: Stream;

  constructor() {
    this.inputChan = new Chan<Buffer>(10);
    this.outputStream = new Stream(1024);
    this.bridge();
  }

  private async bridge() {
    while (true) {
      const data = await this.inputChan.get();
      if (data === Chan.CLOSED) break;
      await this.outputStream.write(data);
    }
    this.outputStream.close();
  }

  async send(data: Buffer): Promise<void> {
    await this.inputChan.put(data);
  }

  async receive(size: number): Promise<Buffer> {
    return this.outputStream.read(size);
  }
}
```

### Error Handling Patterns

```typescript
async function safeChannelOperation<T>(chan: Chan<T>, operation: () => Promise<T>) {
  try {
    const result = await operation();
    await chan.put(result);
  } catch (error) {
    console.error('Channel operation failed:', error);
    chan.close();
  }
}

async function safeStreamOperation(stream: Stream, data: Buffer) {
  if (stream.isClosed()) {
    throw new Error('Stream is closed');
  }
  
  const written = await stream.write(data);
  assert(written === data.length, 'Partial write occurred');
}
```

## Performance Considerations

### Channel Sizing

```typescript
// Small buffer for tight coordination
const syncChan = new Chan<Message>(1);

// Larger buffer for throughput
const batchChan = new Chan<Data[]>(100);

// Unbuffered for memory efficiency  
const streamChan = new Chan<Buffer>();
```

### Stream Buffering

```typescript
// Small buffer for interactive use
const interactiveStream = new Stream(256);

// Large buffer for bulk data
const bulkStream = new Stream(64 * 1024);

// Adaptive buffering
function createAdaptiveStream(usage: 'interactive' | 'bulk' | 'network') {
  const sizes = {
    interactive: 256,
    bulk: 64 * 1024, 
    network: 8 * 1024
  };
  return new Stream(sizes[usage]);
}
```

## File References

- [`chan.ts`](../files/library/chan.md) - Go-like channels for async communication
- [`stream.ts`](../files/library/stream.md) - Buffer-based stream processing
- [`helper.ts`](../files/library/helper.md) - Core utility functions and helpers

The library utilities module provides the fundamental building blocks that enable the virtual shell system to handle async operations, manage data flow, and perform common system tasks efficiently and safely.