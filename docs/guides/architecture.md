# Architecture Overview

## Project Overview

Rosh Blog is a unique Next.js blog application that features an interactive terminal interface powered by a custom virtual shell system called "rosh". The project combines traditional blog functionality with an innovative command-line interface that allows users to explore blog content through familiar Unix-like commands.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
├─────────────────────────┬───────────────────────────────────┤
│    Blog Components      │       Terminal Component          │
│  - Article Rendering    │    - XTerm.js Integration         │
│  - Navigation           │    - Terminal Emulation           │
│  - Layout               │    - Command Processing           │
└─────────────────────────┴───────────────────────────────────┤
│                     Rosh Virtual Shell                      │
├─────────────────────────┬───────────────────────────────────┤
│      Kernel Layer       │        Filesystem Layer          │
│  - Process Management   │    - Virtual File System (VFS)    │
│  - System Calls         │    - Inodes & File Operations     │
│  - Memory Management    │    - Directory Management         │
├─────────────────────────┼───────────────────────────────────┤
│   Built-in Commands     │        Library Utilities         │
│  - echo, cat, ls        │    - Stream Processing            │
│  - env, rosh shell      │    - Helper Functions            │
│  - File Operations      │    - Channel Communication       │
└─────────────────────────┴───────────────────────────────────┘
```

## Core Components

### 1. Rosh Virtual Shell System

The heart of the project is a fully-featured virtual shell system that mimics Unix-like behavior:

- **Virtual Filesystem**: Complete inode-based filesystem with files, directories, and symlinks
- **Process Management**: Process creation, execution, and lifecycle management
- **System Calls**: Full syscall interface for file operations, process control, and I/O
- **Built-in Commands**: Standard Unix commands like `ls`, `cat`, `echo`, `env`

### 2. Frontend Integration

The virtual shell is seamlessly integrated into a Next.js blog:

- **Terminal Component**: XTerm.js-based terminal emulator
- **Content Management**: Blog articles are mounted as files in the virtual filesystem
- **Interactive Experience**: Users can explore blog content using shell commands

### 3. Data Flow

```
User Input → Terminal → Rosh Shell → Kernel → VFS → Content/Commands → Response → Terminal
```

## Module Architecture

### Filesystem Module (`rosh/fs/`)

Implements a complete virtual filesystem with Unix-like semantics:

- **Core Components**: Basic file, directory, and symlink implementations
- **Virtual File System (VFS)**: Path resolution, permission checking, mount points
- **Specialized Filesystems**: Binary files for executables, proc filesystem for system info
- **Wrapper Pattern**: Consistent interface for different inode types

### Kernel Module (`rosh/kernel/`)

Provides process management and system call interface:

- **Process Management**: Process creation, scheduling, and termination
- **System Calls**: Complete syscall layer for filesystem and process operations
- **Memory Management**: Buffer management and file descriptor tables
- **Kernel Builder**: Factory pattern for kernel initialization

### Built-in Commands (`rosh/builtin/`)

Standard Unix-like commands implemented in TypeScript:

- **Basic Commands**: `echo`, `cat`, `ls`, `env`
- **Shell Implementation**: Complete shell with command parsing and execution
- **Utility Functions**: Common operations shared across commands
- **System Integration**: Commands integrate with VFS and kernel layers

### Library Utilities (`rosh/lib/`)

Supporting utilities and abstractions:

- **Stream Processing**: Async stream handling for command I/O
- **Channel Communication**: Go-like channels for async communication
- **Helper Functions**: Path resolution, argument parsing, common operations

### React Components (`components/`)

Frontend components for the blog interface:

- **Terminal Component**: XTerm.js integration with rosh shell
- **MDX Components**: Custom components for rendering blog content
- **Layout Components**: Page structure and navigation

## Key Design Patterns

### 1. Interface Segregation

Each module defines clear interfaces (e.g., `InodeProto`, `FileProto`, `DirProto`) that separate concerns and enable modularity.

### 2. Factory Pattern

The `KernelBuilder` uses factory pattern to construct and configure the kernel with appropriate filesystems and commands.

### 3. Wrapper Pattern

Filesystem wrappers (`FileWrapper`, `DirWrapper`) add consistent behavior (like timestamp updates) around core implementations.

### 4. Syscall Abstraction

All kernel operations go through a syscall layer, providing a clean separation between user-space commands and kernel-space operations.

## Development Workflow

1. **Content Creation**: Blog articles are written in Markdown
2. **Content Layer**: Contentlayer processes Markdown into structured data
3. **Filesystem Mounting**: Articles are mounted as files in the virtual filesystem
4. **Terminal Interaction**: Users explore content through the terminal interface
5. **Command Execution**: Built-in commands provide familiar Unix-like operations

## Security Model

The virtual shell operates in a sandboxed environment:

- **Process Isolation**: Each command runs in its own process context
- **Permission System**: Unix-like permission model for files and directories
- **Safe Execution**: All operations are contained within the virtual environment

## Extension Points

The architecture supports easy extension:

- **New Commands**: Add files to `rosh/builtin/` following the established patterns
- **New Filesystems**: Implement new inode types in `rosh/fs/`
- **System Calls**: Extend the syscall interface in `rosh/kernel/syscall/`
- **UI Components**: Add new React components for enhanced functionality

This architecture provides a solid foundation for both educational exploration of operating system concepts and practical blog functionality with a unique interactive interface.