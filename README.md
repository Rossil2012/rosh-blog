# Rosh Blog

An innovative blog platform that combines modern web development with a complete virtual shell system, allowing users to explore content through an interactive terminal interface.

## 🚀 Overview

Rosh Blog is a unique educational project that implements:

- **Virtual Shell System (rosh)**: A complete Unix-like shell environment in TypeScript
- **Interactive Terminal**: XTerm.js-powered terminal for exploring blog content
- **Virtual Filesystem**: Full inode-based filesystem with files, directories, and symlinks
- **Process Management**: Real process scheduling, system calls, and job control
- **Blog Integration**: Markdown articles accessible as files in the virtual filesystem

## ✨ Features

### Virtual Shell Environment
- **Unix-like Commands**: `ls`, `cat`, `echo`, `env`, and more
- **File Operations**: Read, write, create, and delete files
- **Directory Navigation**: Full directory structure with `cd`, `pwd`, `mkdir`
- **Process Management**: Spawn processes, job control, environment variables
- **System Integration**: `/proc` filesystem, pseudo-terminals, and IPC

### Modern Web Interface
- **React Components**: Modern React with Next.js App Router
- **Terminal Emulation**: Full-featured terminal with XTerm.js
- **Content Management**: Contentlayer for processing Markdown articles
- **Responsive Design**: Works on desktop and mobile devices

### Educational Value
- **Operating System Concepts**: Learn about filesystems, processes, and syscalls
- **Shell Programming**: Understand how shells and commands work
- **Async Programming**: Explore advanced JavaScript/TypeScript patterns
- **System Architecture**: See how complex systems are designed and implemented

## 🛠 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or pnpm (pnpm recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/Rossil2012/rosh-blog.git
cd rosh-blog

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the interactive terminal.

### Try These Commands

```bash
# List files in the current directory
ls

# Navigate to the blog directory
cd /blog

# Read a blog article
cat article-name.md

# Show environment variables
env

# Explore the system
cd /proc
ls
cat self/fd/0
```

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

### Getting Started
- [**Getting Started Guide**](./docs/guides/getting-started.md) - Setup and basic usage
- [**Architecture Overview**](./docs/guides/architecture.md) - High-level system design
- [**Contributing Guidelines**](./docs/guides/contributing.md) - How to contribute
- [**API Reference**](./docs/guides/api-reference.md) - Complete API documentation

### Module Documentation
- [**Filesystem Module**](./docs/modules/filesystem.md) - Virtual filesystem implementation
- [**Kernel Module**](./docs/modules/kernel.md) - Process management and system calls
- [**Built-in Commands**](./docs/modules/builtin.md) - Shell commands and utilities
- [**Library Utilities**](./docs/modules/library.md) - Helper functions and abstractions
- [**React Components**](./docs/modules/components.md) - Frontend UI components

### File References
Detailed documentation for individual files is available in [`docs/files/`](./docs/files/).

## 🏗 Project Structure

```
rosh-blog/
├── 📁 app/                    # Next.js App Router
├── 📁 components/             # React components
├── 📁 content/               # Blog articles (Markdown)
├── 📁 docs/                  # Complete documentation
├── 📁 rosh/                  # Virtual shell system
│   ├── 📁 fs/               # Filesystem implementation
│   ├── 📁 kernel/           # Process management & syscalls
│   ├── 📁 builtin/          # Built-in shell commands
│   └── 📁 lib/              # Utility libraries
├── 📁 public/               # Static assets
└── 📄 package.json         # Dependencies and scripts
```

## 🧠 Core Concepts

### Virtual Filesystem
The system implements a complete Unix-like filesystem with:
- **Inodes**: Files, directories, and symbolic links
- **Permissions**: Unix-style permission checking
- **Mount Points**: Ability to mount different filesystems
- **Special Files**: `/proc` filesystem for system information

### Process Management
Full process lifecycle management:
- **Process Creation**: Spawn new processes with arguments
- **Scheduling**: Cooperative scheduling with async/await
- **System Calls**: Complete syscall interface
- **Environment**: Per-process environment variables and working directories

### Command Execution
Commands are implemented as TypeScript classes:
```typescript
export class MyCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    yield SysWriteAll(stdout, Buffer.from("Hello, World!\n"));
    return 0;
  }
}
```

## 🎯 Use Cases

### Educational
- **Learn Operating Systems**: Understand how filesystems and processes work
- **Shell Programming**: Practice command-line skills in a safe environment
- **TypeScript/JavaScript**: Explore advanced async programming patterns

### Development
- **Prototyping**: Quick experimentation with system concepts
- **Teaching**: Demonstrate OS concepts with working code
- **Research**: Explore new ideas in system design

### Content
- **Interactive Blog**: Unique way to present technical content
- **Documentation**: Provide hands-on experience with concepts
- **Tutorials**: Let readers experiment as they learn

## 🤝 Contributing

We welcome contributions! Here are some ways to help:

- **Add Commands**: Implement new shell commands
- **Improve Documentation**: Help others understand the system
- **Fix Bugs**: Report and fix issues
- **Add Features**: Extend the filesystem or kernel
- **Write Content**: Create blog articles using the system

See our [Contributing Guidelines](./docs/guides/contributing.md) for detailed information.

## 📖 Examples

### Adding a New Command

```typescript
// rosh/builtin/mycommand.ts
export class MyCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    if (args.length === 0) {
      yield SysWriteAll(stderr, Buffer.from("Usage: mycommand <message>\n"));
      return 1;
    }
    
    yield SysWriteAll(stdout, Buffer.from(`You said: ${args.join(' ')}\n`));
    return 0;
  }
}
```

### Creating a Custom File Type

```typescript
// Custom file that shows current time
export class ClockFile extends File {
  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const time = new Date().toISOString();
    const data = Buffer.from(time);
    return data.slice(offset, offset + size);
  }
}
```

### Extending the React Interface

```typescript
// Add custom terminal themes
const useTerminalTheme = (themeName: string) => {
  const themes = {
    dark: { background: '#1e1e1e', foreground: '#d4d4d4' },
    light: { background: '#ffffff', foreground: '#333333' }
  };
  return themes[themeName] || themes.dark;
};
```

## 🔧 Development

### Scripts
```bash
pnpm dev       # Start development server
pnpm build     # Build for production
pnpm start     # Start production server
pnpm lint      # Run ESLint
pnpm clean     # Clean build artifacts
```

### Testing
```bash
npx tsc --noEmit  # Type check
pnpm lint         # Lint code
```

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **XTerm.js**: Terminal emulation in the browser
- **Next.js**: React framework for web applications
- **Contentlayer**: Content management for Markdown
- **TypeScript**: Type-safe JavaScript development

## 📞 Support

- **Documentation**: Check the [docs](./docs/) directory
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Ask questions on GitHub Discussions
- **Contributing**: See [Contributing Guidelines](./docs/guides/contributing.md)

---

**Explore the future of interactive documentation and system education with Rosh Blog!** 🚀
