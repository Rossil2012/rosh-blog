# Built-in Commands Module (`rosh/builtin/`)

The built-in commands module provides a collection of Unix-like commands that run within the virtual shell system. These commands implement familiar functionality like file operations, text processing, and system utilities.

## Module Overview

The built-in commands module includes:

- **Basic Commands** - `echo`, `cat`, `ls`, `env`
- **Shell Implementation** - Complete interactive shell (`rosh/`)
- **System Integration** - `initImage.ts` for system initialization
- **Connection Management** - Terminal connection handling
- **Utility Functions** - Common operations shared across commands

## Architecture

### Command Structure

All commands follow a consistent pattern by extending the `Process` class:

```typescript
export class CommandName extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    // Command implementation using system calls
    // Yield system calls for I/O and other operations
    // Return exit code (0 for success, non-zero for error)
    return 0;
  }
}
```

### System Call Integration

Commands interact with the system through the syscall interface:

```typescript
// File operations
yield SysOpen(path, OpenFlags.READ);
yield SysRead(fd, size);
yield SysWrite(fd, data);
yield SysClose(fd);

// Directory operations
yield SysGetdents(fd);
yield SysGetcwd();
yield SysChdir(path);

// Process operations
yield SysSpawn(ProcessClass, ...args);
yield SysExit(code);
```

## Core Commands

### 1. Echo Command - `echo.ts`

Outputs text to stdout:

```typescript
export class Echo extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    yield SysWriteAll(stdout, Buffer.from(args.join(' ') + '\r\n'));
    return 0;
  }
}
```

**Usage:**
```bash
echo "Hello, World!"
echo one two three
```

**Features:**
- Concatenates arguments with spaces
- Adds newline termination
- Supports any number of arguments

### 2. Cat Command - `cat.ts`

Displays file contents or reads from stdin:

```typescript
export class Cat extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    const fd = args.length > 0 ? (yield SysOpen(args[0], OpenFlags.READ)) as number : stdin;

    while (true) {
      const result = (yield SysGetLine(fd)) as { line: string, eof: boolean };
      if (result.eof) break;
      
      yield SysWriteAll(stdout, Buffer.from('cat ' + result.line + '\r\n'));
    }

    if (fd !== stdin) {
      yield SysClose(fd);
    }
    return 0;
  }
}
```

**Usage:**
```bash
cat file.txt          # Display file contents
cat                    # Read from stdin
```

**Features:**
- Reads file line by line
- Handles stdin when no file specified
- Proper file descriptor management
- Error handling for file access

### 3. Ls Command - `ls.ts`

Lists directory contents:

```typescript
export class Ls extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    const pwd = (yield SysGetcwd()) as string;
    const fd = (yield SysOpen(pwd, OpenFlags.DIR | OpenFlags.READ)) as number;
    const entries = (yield SysGetdents(fd)) as string[];
    
    yield SysClose(fd);
    yield SysWriteAll(stdout, Buffer.from(entries.join('\r\n') + '\r\n'));
    return 0;
  }
}
```

**Usage:**
```bash
ls                     # List current directory
```

**Features:**
- Lists current working directory
- One file per line output
- Proper directory handling
- Resource cleanup

### 4. Env Command - `env.ts`

Displays environment variables:

```typescript
export class Env extends Process {
  async *run(): AsyncGenerator<Syscall, number, unknown> {
    const env = (yield SysEnvironment()) as Record<string, string>;
    yield SysWriteAll(stdout, Buffer.from(
      Object.entries(env).map(entry => entry.join('=')).join('\r\n') + '\r\n'
    ));
    return 0;
  }
}
```

**Usage:**
```bash
env                    # Display all environment variables
```

**Features:**
- Shows all environment variables
- KEY=VALUE format
- Sorted output

## Shell Implementation (`rosh/`)

The shell implementation provides a complete interactive command-line interface:

### Core Components

#### 1. Main Shell - `rosh.ts`

The main shell process handles:
- Command line reading and parsing
- Command execution
- Job control
- Environment management

```typescript
export class Rosh extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    // Initialize shell environment
    // Main command loop
    // Parse and execute commands
    // Handle built-in commands
    return 0;
  }
}
```

#### 2. Terminal Management - `term.ts`

Handles terminal I/O and command line editing:

```typescript
export class Term {
  // Command line editing
  // History management  
  // Terminal control sequences
  // Key mapping and input handling
}
```

#### 3. Command Runner - `runner.ts`

Executes parsed commands:

```typescript
export const execStmt = async function*(
  stmt: Stmt, 
  ctx: ProcessContext
): AsyncGenerator<Syscall, number, unknown> {
  // Parse command statement
  // Handle pipes and redirections
  // Execute command with arguments
  // Return exit status
}
```

#### 4. Environment Management - `env.ts`

Manages shell environment and variables:

```typescript
export class Environment {
  // Environment variable storage
  // Variable expansion
  // PATH resolution
  // Shell options
}
```

### Shell Features

#### Command Parsing
- Full shell syntax support via mvdan-sh parser
- Command substitution
- Variable expansion
- Quote handling

#### Interactive Features
- Command line editing
- History support
- Tab completion (planned)
- Job control

#### Built-in Shell Commands
- `cd` - Change directory
- `exit` - Exit shell
- `export` - Set environment variables
- `source` - Execute script files

## System Integration

### Initialization - `initImage.ts`

Creates the initial filesystem structure with built-in commands:

```typescript
const imageConfig: FSConfigMap = {
  "usr": [CoreDir, { mode: 0o755 }, markChildren({
    "bin": [CoreDir, { mode: 0o755 }, markChildren({
      "rosh": [BinFile, { mode: 0o755 }, Rosh],
      "echo": [BinFile, { mode: 0o755 }, Echo],
      "cat":  [BinFile, { mode: 0o755 }, Cat],
      "env":  [BinFile, { mode: 0o755 }, Env],
      "ls":   [BinFile, { mode: 0o755 }, Ls]
    })]
  })],
  "proc": [ProcDir],
  // Additional filesystem structure...
};
```

**Features:**
- Automatic filesystem layout
- Binary file mounting for commands
- System directory structure
- Configuration-driven setup

### Connection Management - `connection.ts`

Handles terminal connections and I/O:

```typescript
export class RoshConnection {
  // Terminal input/output
  // Connection lifecycle
  // Data buffering
  // Session management
}
```

## Utility Functions - `utils.ts`

Shared utilities for command implementation:

### String Processing
```typescript
export const getUTF8String = (buffer: Buffer): { parsedStr: string, newBuffer: Buffer };
export const removeEndSubstring = (str: string, end: string): string;
export const nthIndexOf = (mainStr: string, subStr: string, n: number): number;
```

### Numeric Utilities
```typescript
export const clamp = (n: number, min: number, max: number): number;
```

### Key Mapping
```typescript
const keyMap: keyMap = {
  '\x1b': {
    '\x1b[A': 'arrow_up',
    '\x1b[B': 'arrow_down',
    '\x1b[C': 'arrow_right',
    '\x1b[D': 'arrow_left'
  },
  '\x7f': 'backspace'
}
```

## Usage Examples

### Creating a New Command

```typescript
import { Process, SysWriteAll, stdout } from "../internal";
import { Buffer } from "buffer";

export class MyCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    // Validate arguments
    if (args.length === 0) {
      yield SysWriteAll(stdout, Buffer.from("Usage: mycommand <arg>\r\n"));
      return 1;
    }

    // Perform command logic
    const result = await processArgs(args);
    
    // Output result
    yield SysWriteAll(stdout, Buffer.from(result + '\r\n'));
    
    return 0;
  }
}
```

### File Processing Command

```typescript
export class WordCount extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    for (const filename of args) {
      const fd = yield SysOpen(filename, OpenFlags.READ) as number;
      
      let lineCount = 0;
      while (true) {
        const result = yield SysGetLine(fd) as { line: string, eof: boolean };
        if (result.eof) break;
        lineCount++;
      }
      
      yield SysClose(fd);
      yield SysWriteAll(stdout, Buffer.from(`${lineCount} ${filename}\r\n`));
    }
    
    return 0;
  }
}
```

### Interactive Command

```typescript
export class Calculator extends Process {
  async *run(): AsyncGenerator<Syscall, number, unknown> {
    yield SysWriteAll(stdout, Buffer.from("Calculator (type 'quit' to exit)\r\n"));
    
    while (true) {
      yield SysWriteAll(stdout, Buffer.from("> "));
      
      const input = yield SysGetLine(stdin) as { line: string, eof: boolean };
      if (input.eof || input.line.trim() === 'quit') break;
      
      try {
        const result = eval(input.line.trim());
        yield SysWriteAll(stdout, Buffer.from(`${result}\r\n`));
      } catch (error) {
        yield SysWriteAll(stdout, Buffer.from(`Error: ${error.message}\r\n`));
      }
    }
    
    return 0;
  }
}
```

## Error Handling

Commands should handle errors gracefully:

```typescript
export class SafeCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    try {
      const fd = yield SysOpen(args[0], OpenFlags.READ) as number;
      // ... command logic
      yield SysClose(fd);
      return 0;
    } catch (error) {
      yield SysWriteAll(stderr, Buffer.from(`Error: ${error.message}\r\n`));
      return 1;
    }
  }
}
```

## Integration with Blog Content

Commands can access blog content through the virtual filesystem:

```typescript
// Blog articles are mounted as files in the VFS
// Commands can read and process blog content
const articleContent = yield SysRead(fd, size);
const processed = processBlogMarkdown(articleContent.toString());
yield SysWriteAll(stdout, Buffer.from(processed));
```

## File References

- [`echo.ts`](../files/builtin/echo.md) - Simple text output command
- [`cat.ts`](../files/builtin/cat.md) - File content display command
- [`ls.ts`](../files/builtin/ls.md) - Directory listing command
- [`env.ts`](../files/builtin/env.md) - Environment variable display
- [`rosh/rosh.ts`](../files/builtin/rosh-shell.md) - Main shell implementation
- [`rosh/term.ts`](../files/builtin/rosh-term.md) - Terminal management
- [`rosh/runner.ts`](../files/builtin/rosh-runner.md) - Command execution
- [`utils.ts`](../files/builtin/utils.md) - Shared utility functions
- [`initImage.ts`](../files/builtin/initImage.md) - System initialization
- [`connection.ts`](../files/builtin/connection.md) - Connection management

The built-in commands module provides a rich set of familiar Unix-like tools while maintaining integration with the blog system and enabling users to explore content through traditional command-line interfaces.