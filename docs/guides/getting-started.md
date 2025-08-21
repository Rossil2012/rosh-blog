# Getting Started Guide

This guide will help you set up the Rosh Blog project for development and understand how to work with the codebase.

## Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** or **pnpm** (pnpm recommended)
- **Git** for version control
- A modern code editor (VS Code recommended)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Rossil2012/rosh-blog.git
cd rosh-blog
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Using pnpm (recommended):
```bash
pnpm install
```

### 3. Environment Setup

The project doesn't require environment variables for basic functionality, but you may want to create a `.env.local` file for custom configurations:

```bash
# Optional: Create environment file
touch .env.local
```

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

This will start the Next.js development server on `http://localhost:3000`.

### 2. Project Structure Overview

```
rosh-blog/
├── app/                    # Next.js App Router (pages and layouts)
├── components/             # React components
├── content/               # Blog articles in Markdown
├── docs/                  # Project documentation (you're reading this!)
├── public/                # Static assets
├── rosh/                  # Virtual shell system
│   ├── fs/               # Filesystem implementation
│   ├── kernel/           # Process management and syscalls
│   ├── builtin/          # Built-in shell commands
│   └── lib/              # Utility libraries
├── package.json          # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # Basic project information
```

### 3. Understanding the Terminal Interface

When you visit `http://localhost:3000`, you'll see an interactive terminal. This terminal is powered by the virtual shell system (rosh) and allows you to explore blog content using Unix-like commands.

**Basic Commands to Try:**
```bash
# List files in current directory
ls

# Navigate to blog directory
cd /blog

# List blog articles
ls

# Read a blog article
cat article-name.md

# Show environment variables
env

# Get help
help
```

## Development Tasks

### Adding New Blog Articles

1. Create a new Markdown file in the `content/article/` directory:

```bash
mkdir -p content/article/my-new-post
touch content/article/my-new-post/index.md
```

2. Add frontmatter and content to your article:

```markdown
---
title: "My New Blog Post"
date: "2023-12-01"
description: "A description of my blog post"
---

# My New Blog Post

This is the content of my blog post...
```

3. The article will automatically be available in the terminal at `/blog/my-new-post`.

### Adding New Shell Commands

1. Create a new command file in `rosh/builtin/`:

```typescript
// rosh/builtin/mycommand.ts
import { Process, SysWriteAll, stdout } from "../internal";
import { Buffer } from "buffer";

export class MyCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    const message = args.length > 0 ? args.join(' ') : "Hello from MyCommand!";
    yield SysWriteAll(stdout, Buffer.from(message + '\r\n'));
    return 0;
  }
}
```

2. Export your command from `rosh/internal.ts`:

```typescript
export * from "./builtin/mycommand";
```

3. Register your command in the initial image (`rosh/builtin/initImage.ts`):

```typescript
const imageConfig: FSConfigMap = {
  // ... existing config
  "usr": [CoreDir, { mode: 0o755 }, markChildren({
    "bin": [CoreDir, { mode: 0o755 }, markChildren({
      // ... existing commands
      "mycommand": [BinFile, { mode: 0o755 }, MyCommand]
    })]
  })],
  // ... rest of config
};
```

### Modifying the Filesystem

The virtual filesystem can be extended by creating new inode types or modifying existing ones:

1. **Create a custom file type:**

```typescript
// Example: A file that always returns the current date
export class DateFile extends File {
  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    const dateString = new Date().toISOString();
    const data = Buffer.from(dateString);
    return data.slice(offset, offset + size);
  }
}
```

2. **Mount custom filesystems:**

```typescript
// In components/Terminal.tsx
const setupConnection = async () => {
  const builder = KernelBuilder.default();
  
  // Mount your custom filesystem
  const customDir = new CoreDir({ mode: 0o755 });
  customDir.children_.set('current-date', new DateFile({ mode: 0o644 }));
  builder.withMount("/custom", customDir);
  
  // ... rest of setup
};
```

## Building and Testing

### Build for Production

```bash
npm run build
# or
pnpm build
```

This creates an optimized production build in the `.next` directory.

### Linting

```bash
npm run lint
# or
pnpm lint
```

### Code Quality

The project uses TypeScript for type safety. Always run the TypeScript compiler to check for errors:

```bash
npx tsc --noEmit
```

## Common Development Patterns

### 1. Process Implementation Pattern

All commands follow this pattern:

```typescript
export class CommandName extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    // 1. Validate arguments
    if (args.length === 0) {
      yield SysWriteAll(stderr, Buffer.from("Usage: command <arg>\n"));
      return 1;
    }

    // 2. Perform system operations via syscalls
    const fd = yield SysOpen(args[0], OpenFlags.READ) as number;
    
    // 3. Process data
    const data = yield SysRead(fd, 1024) as Buffer;
    
    // 4. Output results
    yield SysWriteAll(stdout, data);
    
    // 5. Clean up resources
    yield SysClose(fd);
    
    // 6. Return exit code
    return 0;
  }
}
```

### 2. Filesystem Extension Pattern

```typescript
export class CustomInode extends File {
  constructor(customData: any) {
    super({ mode: 0o644 });
    // Initialize with custom data
  }

  async read(ctx: ProcessContext, handle: FileHandle, size: number, offset: number): Promise<Buffer> {
    // Custom read implementation
    return Buffer.from("custom data");
  }

  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    // Custom write implementation
    return data.length;
  }
}
```

### 3. React Component Integration Pattern

```typescript
const useKernelConnection = () => {
  const [kernel, setKernel] = useState<Kernel | null>(null);
  const [connection, setConnection] = useState<RoshConnection | null>(null);

  useEffect(() => {
    const setup = async () => {
      const builder = KernelBuilder.default();
      // ... configuration
      const [k, c] = await builder.buildWithConnection();
      setKernel(k);
      setConnection(c);
    };
    
    setup();
    
    return () => {
      connection?.close();
    };
  }, []);

  return { kernel, connection };
};
```

## Debugging Tips

### 1. Console Logging

Add console.log statements in your processes to debug:

```typescript
export class DebugCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    console.log('DebugCommand called with args:', args);
    
    // ... command implementation
    
    console.log('DebugCommand completing');
    return 0;
  }
}
```

### 2. Inspect Filesystem State

You can inspect the virtual filesystem state:

```typescript
// In browser console
console.log(kernel.getVfs());
```

### 3. Monitor Process State

```typescript
// In browser console  
console.log(kernel.getAllProcess());
```

## Next Steps

1. **Explore the Documentation**: Read through the [Architecture Overview](./architecture.md) to understand the system design
2. **Study the Modules**: Review each module's documentation:
   - [Filesystem Module](../modules/filesystem.md)
   - [Kernel Module](../modules/kernel.md)
   - [Built-in Commands](../modules/builtin.md)
   - [Library Utilities](../modules/library.md)
   - [React Components](../modules/components.md)
3. **Try Examples**: Experiment with the terminal interface and try different commands
4. **Build Something**: Create your own commands or extend the filesystem

## Getting Help

- **Documentation**: Check the [docs](../README.md) directory for detailed information
- **Code Examples**: Look at existing commands in `rosh/builtin/` for patterns
- **Issues**: Report bugs or ask questions on the project's GitHub issues page

Remember: The virtual shell system is designed to be educational and extensible. Don't hesitate to experiment and modify the code to understand how it works!