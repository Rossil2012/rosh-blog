# File Reference: `rosh/builtin/echo.ts`

## Overview

The `echo.ts` file implements the `echo` command, which outputs its arguments to stdout. This is one of the fundamental Unix commands and serves as an excellent example of how to implement simple shell commands in the rosh virtual shell system.

## Implementation

### Complete Source Code

```typescript
import { Process, SysWriteAll, Syscall, stdout } from "../internal";
import { Buffer } from "buffer";

export class Echo extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    yield SysWriteAll(stdout, Buffer.from(args.join(' ') + '\r\n'));
    
    return 0;
  }
}
```

## Code Analysis

### Class Definition

```typescript
export class Echo extends Process
```

**Key Points**:
- Extends the `Process` base class (required for all commands)
- Exported for use by the kernel and initialization system
- Class name follows PascalCase convention

### Main Execution Method

```typescript
async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown>
```

**Method Signature**:
- `async *`: Async generator function (required pattern for all processes)
- `...args: any[]`: Variable number of arguments passed from command line
- Returns: `AsyncGenerator<Syscall, number, unknown>`
  - Yields `Syscall` objects for kernel operations
  - Returns `number` as exit code (0 = success, non-zero = error)

### Argument Processing

```typescript
args.join(' ')
```

**Functionality**:
- Takes all command line arguments
- Joins them with single spaces
- Preserves original spacing between words
- Empty array becomes empty string

**Examples**:
```bash
echo hello world     # args = ["hello", "world"] → "hello world"
echo "one two"       # args = ["one two"] → "one two"  
echo                 # args = [] → ""
```

### Output Generation

```typescript
yield SysWriteAll(stdout, Buffer.from(args.join(' ') + '\r\n'));
```

**Components**:
1. `args.join(' ')`: Create output string from arguments
2. `+ '\r\n'`: Add carriage return + newline (Windows-style line ending)
3. `Buffer.from()`: Convert string to Buffer for system call
4. `SysWriteAll()`: System call to write all data to file descriptor
5. `stdout`: Standard output file descriptor (typically fd 1)
6. `yield`: Pass control to kernel to execute the system call

### Exit Code

```typescript
return 0;
```

**Convention**:
- `0`: Success (Unix convention)
- `non-zero`: Error (various error codes)
- Echo command rarely fails, so always returns 0

## System Call Details

### SysWriteAll Function

```typescript
SysWriteAll(fd: number, data: Buffer): FcnSyscall
```

**Purpose**: Write all data to a file descriptor, handling partial writes automatically.

**Parameters**:
- `fd`: File descriptor (stdout = 1, stderr = 2)
- `data`: Buffer containing data to write

**Behavior**:
- Attempts to write all data
- Handles partial writes by retrying
- Returns total bytes written
- May block if output buffer is full

### Alternative: SysWrite

```typescript
// Could use SysWrite for single write attempt
yield SysWrite(stdout, Buffer.from(text));
```

**Difference**:
- `SysWrite`: Single write attempt, may write partial data
- `SysWriteAll`: Guaranteed to write all data (or error)

## Usage Examples

### Basic Usage

```bash
echo Hello, World!
# Output: Hello, World!
```

### Multiple Arguments

```bash
echo one two three
# Output: one two three
```

### Empty Arguments

```bash
echo
# Output: (empty line)
```

### Quoted Arguments

```bash
echo "Hello World" test
# Output: Hello World test
```

### Special Characters

```bash
echo "Hello\nWorld"  
# Output: Hello\nWorld (literal \n, not newline)
```

## Enhancements and Variations

### Enhanced Echo with Options

```typescript
export class EnhancedEcho extends Process {
  async *run(...args: string[]): AsyncGenerator<Syscall, number, unknown> {
    let outputArgs = [...args];
    let addNewline = true;
    let interpretEscapes = false;

    // Parse options
    while (outputArgs.length > 0 && outputArgs[0].startsWith('-')) {
      const option = outputArgs.shift();
      
      switch (option) {
        case '-n':
          addNewline = false;
          break;
        case '-e':
          interpretEscapes = true;
          break;
        case '-E':
          interpretEscapes = false;
          break;
        default:
          yield SysWriteAll(stderr, Buffer.from(`echo: invalid option ${option}\n`));
          return 1;
      }
    }

    let output = outputArgs.join(' ');
    
    if (interpretEscapes) {
      output = output.replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\r/g, '\r')
                    .replace(/\\\\/g, '\\');
    }
    
    if (addNewline) {
      output += '\r\n';
    }

    yield SysWriteAll(stdout, Buffer.from(output));
    return 0;
  }
}
```

### Echo with Error Handling

```typescript
export class SafeEcho extends Process {
  async *run(...args: string[]): AsyncGenerator<Syscall, number, unknown> {
    try {
      const text = args.join(' ') + '\r\n';
      const result = yield SysWriteAll(stdout, Buffer.from(text)) as { totalLength: number, eof: boolean };
      
      if (result.eof) {
        yield SysWriteAll(stderr, Buffer.from("echo: output truncated\n"));
        return 1;
      }
      
      return 0;
    } catch (error) {
      yield SysWriteAll(stderr, Buffer.from(`echo: ${error.message}\n`));
      return 1;
    }
  }
}
```

### Echo with File Output

```typescript
export class FileEcho extends Process {
  async *run(...args: string[]): AsyncGenerator<Syscall, number, unknown> {
    if (args.length < 2) {
      yield SysWriteAll(stderr, Buffer.from("Usage: file-echo <text> <filename>\n"));
      return 1;
    }

    const filename = args.pop();
    const text = args.join(' ') + '\n';

    try {
      const fd = yield SysOpen(filename, OpenFlags.WRITE | OpenFlags.CREAT, 0o644) as number;
      yield SysWriteAll(fd, Buffer.from(text));
      yield SysClose(fd);
      return 0;
    } catch (error) {
      yield SysWriteAll(stderr, Buffer.from(`file-echo: ${error.message}\n`));
      return 1;
    }
  }
}
```

## Integration Points

### Command Registration

The echo command is registered in the initial filesystem image:

```typescript
// In rosh/builtin/initImage.ts
const imageConfig: FSConfigMap = {
  "usr": [CoreDir, { mode: 0o755 }, markChildren({
    "bin": [CoreDir, { mode: 0o755 }, markChildren({
      "echo": [BinFile, { mode: 0o755 }, Echo],
      // ... other commands
    })]
  })]
};
```

### Module Exports

```typescript
// In rosh/internal.ts
export * from "./builtin/echo";
```

### Shell Integration

The shell finds and executes echo through the PATH:

```bash
# Shell resolves "echo" to "/usr/bin/echo"
# Loads Echo class from BinFile
# Spawns new process with Echo class
# Passes arguments to run() method
```

## Testing Patterns

### Unit Testing

```typescript
describe('Echo Command', () => {
  let kernel: Kernel;
  let ctx: ProcessContext;

  beforeEach(async () => {
    kernel = await KernelBuilder.default().build();
    ctx = createTestContext(kernel);
  });

  test('should output arguments', async () => {
    const proc = await kernel.spawn(Echo, "hello", "world");
    const exitCode = await proc.wait();
    
    expect(exitCode).toBe(0);
    // Check stdout contains "hello world\r\n"
  });

  test('should handle empty arguments', async () => {
    const proc = await kernel.spawn(Echo);
    const exitCode = await proc.wait();
    
    expect(exitCode).toBe(0);
    // Check stdout contains "\r\n"
  });
});
```

### Integration Testing

```typescript
test('echo command through shell', async () => {
  const [kernel, connection] = await KernelBuilder.default().buildWithConnection();
  
  const output = await executeCommand(connection, 'echo "Hello, World!"');
  expect(output).toContain('Hello, World!');
});
```

## Performance Considerations

### Memory Usage
- Minimal memory footprint
- Arguments are processed once
- Buffer created only for output
- No persistent state

### Execution Speed
- Single system call for output
- No complex processing
- Immediate return after write
- Optimal for frequent use

### Scalability
- Each echo process is independent
- No shared state between instances
- Can handle concurrent executions
- No resource contention

## Educational Value

The echo command demonstrates several key concepts:

### Process Implementation
- How to extend the Process base class
- Async generator pattern for system calls
- Argument handling and processing
- Exit code conventions

### System Calls
- Using SysWriteAll for output
- Working with file descriptors
- Buffer management
- Error handling patterns

### Unix Philosophy
- Simple, focused functionality
- Composable with other commands
- Standard input/output conventions
- Consistent behavior

## Common Pitfalls

### Line Ending Issues
```typescript
// Wrong: Unix line ending only
Buffer.from(text + '\n')

// Correct: Windows-compatible line ending
Buffer.from(text + '\r\n')
```

### Argument Type Issues
```typescript
// Potential issue: args might not be strings
args.join(' ')  // Could fail if args contains non-strings

// Safer approach:
args.map(String).join(' ')
```

### Missing Exports
```typescript
// Must export the class
export class Echo extends Process { ... }

// Must be imported in internal.ts
export * from "./builtin/echo";
```

The echo command, while simple, provides an excellent foundation for understanding how commands work in the rosh virtual shell system and serves as a template for implementing more complex commands.