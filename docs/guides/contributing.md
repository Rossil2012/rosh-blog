# Contributing Guidelines

Thank you for your interest in contributing to Rosh Blog! This guide will help you understand how to contribute effectively to this unique project that combines virtual shell systems with modern web development.

## Project Overview

Rosh Blog is an educational and innovative project that implements:
- A complete virtual shell system (rosh) in TypeScript
- Unix-like filesystem semantics in the browser
- Process management and system calls
- Interactive terminal interface using XTerm.js
- Blog content accessible through shell commands

## Ways to Contribute

### 1. Code Contributions

#### New Shell Commands
Add useful commands to enhance the shell experience:

```typescript
// Example: word count command
export class Wc extends Process {
  async *run(...args: string[]): AsyncGenerator<Syscall, number, unknown> {
    if (args.length === 0) {
      yield SysWriteAll(stderr, Buffer.from("Usage: wc <file>\n"));
      return 1;
    }

    const fd = yield SysOpen(args[0], OpenFlags.READ) as number;
    let lines = 0, words = 0, chars = 0;
    
    while (true) {
      const result = yield SysGetLine(fd) as { line: string, eof: boolean };
      if (result.eof) break;
      
      lines++;
      words += result.line.split(/\s+/).filter(w => w.length > 0).length;
      chars += result.line.length + 1; // +1 for newline
    }
    
    yield SysClose(fd);
    yield SysWriteAll(stdout, Buffer.from(`${lines} ${words} ${chars} ${args[0]}\n`));
    return 0;
  }
}
```

#### Filesystem Extensions
Implement new inode types or filesystem features:

```typescript
// Example: JSON file type with syntax validation
export class JsonFile extends CoreFile {
  async write(ctx: ProcessContext, handle: FileHandle, data: Buffer, offset: number): Promise<number> {
    try {
      JSON.parse(data.toString()); // Validate JSON
      return super.write(ctx, handle, data, offset);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }
}
```

#### React Component Improvements
Enhance the frontend experience:

```typescript
// Example: Terminal themes
const TerminalThemes = {
  dark: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    // ... more colors
  },
  light: {
    background: '#ffffff',
    foreground: '#333333',
    // ... more colors
  }
};

const useTerminalTheme = (themeName: string) => {
  return TerminalThemes[themeName] || TerminalThemes.dark;
};
```

### 2. Documentation Contributions

#### API Documentation
Help document APIs with clear examples:

```typescript
/**
 * Opens a file or directory
 * @param ctx Process context
 * @param path File path (absolute or relative)
 * @param flags Open flags (READ, WRITE, etc.)
 * @param mode Optional file creation mode
 * @returns Promise resolving to FileHandle
 * @throws ENOENT if file doesn't exist and CREAT not specified
 * @throws EACCES if permission denied
 * @example
 * ```typescript
 * const handle = await vfs.open(ctx, '/etc/passwd', OpenFlags.READ);
 * ```
 */
async open(ctx: ProcessContext, path: string, flags: number, mode?: number): Promise<FileHandle>
```

#### Tutorial Content
Create tutorials for specific use cases:

- "Building Your First Shell Command"
- "Understanding the Virtual Filesystem"
- "Creating Custom React Components"
- "Debugging Virtual Processes"

### 3. Testing Contributions

#### Unit Tests
Add tests for core functionality:

```typescript
// Example: Testing filesystem operations
describe('CoreDir', () => {
  let dir: CoreDir;
  let ctx: ProcessContext;

  beforeEach(() => {
    dir = new CoreDir({ mode: 0o755 });
    ctx = createMockProcessContext();
  });

  test('should list empty directory', async () => {
    const files = await dir.list(ctx);
    expect(files).toEqual([]);
  });

  test('should create and list files', async () => {
    await dir.create(ctx, 'test.txt', 0o644);
    const files = await dir.list(ctx);
    expect(files).toContain('test.txt');
  });
});
```

#### Integration Tests
Test interactions between components:

```typescript
// Example: Testing command execution
describe('Shell Commands', () => {
  let kernel: Kernel;
  let connection: RoshConnection;

  beforeEach(async () => {
    [kernel, connection] = await KernelBuilder.default().buildWithConnection();
  });

  test('ls command should list files', async () => {
    const output = await executeCommand(connection, 'ls');
    expect(output).toContain('bin');
    expect(output).toContain('etc');
  });
});
```

### 4. Bug Reports and Feature Requests

#### Bug Reports
When reporting bugs, please include:

1. **Environment**: OS, browser, Node.js version
2. **Steps to reproduce**: Clear step-by-step instructions
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Console output**: Any error messages or logs
6. **Code snippets**: Minimal reproduction case

Example bug report:
```markdown
## Bug: Cat command doesn't handle binary files

**Environment**: Chrome 120, macOS 14

**Steps to reproduce**:
1. Create a binary file in the virtual filesystem
2. Run `cat binary-file`
3. Observe garbled output

**Expected**: Should display hex dump or refuse to display binary content
**Actual**: Displays garbled text

**Console output**:
```
UnicodeDecodeError: invalid utf-8 sequence
```
```

#### Feature Requests
For feature requests, please describe:

1. **Use case**: Why is this feature needed?
2. **Proposed solution**: How should it work?
3. **Alternatives**: Other ways to solve the problem
4. **Implementation ideas**: Technical approach (if you have ideas)

## Development Setup

### 1. Fork and Clone

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/rosh-blog.git
cd rosh-blog
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 4. Development Workflow

```bash
# Start development server
pnpm dev

# Run tests (when available)
pnpm test

# Check TypeScript
npx tsc --noEmit

# Run linting
pnpm lint
```

## Code Style Guidelines

### TypeScript Standards

1. **Use strict typing**: Avoid `any` type
2. **Prefer interfaces over types** for object shapes
3. **Use async/await** instead of Promise chains
4. **Follow naming conventions**:
   - Classes: PascalCase (`CoreFile`)
   - Functions/variables: camelCase (`openFile`)
   - Constants: UPPER_SNAKE_CASE (`MAX_BUFFER_SIZE`)
   - Private members: prefix with underscore (`private data_: Buffer`)

### Process Implementation Standards

```typescript
export class YourCommand extends Process {
  async *run(...args: any[]): AsyncGenerator<Syscall, number, unknown> {
    // 1. Validate arguments early
    if (args.length < 1) {
      yield SysWriteAll(stderr, Buffer.from("Usage: yourcommand <arg>\n"));
      return 1;
    }

    try {
      // 2. Perform operations with proper error handling
      const fd = yield SysOpen(args[0], OpenFlags.READ) as number;
      
      // 3. Clean up resources
      yield SysClose(fd);
      
      // 4. Return appropriate exit code
      return 0;
    } catch (error) {
      yield SysWriteAll(stderr, Buffer.from(`Error: ${error.message}\n`));
      return 1;
    }
  }
}
```

### React Component Standards

```typescript
interface ComponentProps {
  // Always define prop interfaces
  data: string;
  onAction?: (value: string) => void;
}

const Component: FC<ComponentProps> = ({ data, onAction }) => {
  // Use proper hooks patterns
  const [state, setState] = useState<string>('');
  
  // Handle cleanup in effects
  useEffect(() => {
    const cleanup = setupSomething();
    return cleanup;
  }, []);

  // Memoize callbacks
  const handleClick = useCallback(() => {
    onAction?.(state);
  }, [state, onAction]);

  return (
    <div onClick={handleClick}>
      {data}
    </div>
  );
};

export default React.memo(Component);
```

## Commit Guidelines

### Commit Messages
Follow conventional commit format:

```
type(scope): description

Optional longer description

Fixes #123
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(commands): add word count command

Implements wc command with line, word, and character counting
functionality. Supports multiple files and follows Unix wc behavior.

Fixes #45

fix(filesystem): handle empty directory listing

Empty directories were returning undefined instead of empty array,
causing commands to crash.

docs(api): add examples for VFS operations

Added comprehensive examples for filesystem operations including
error handling patterns and common use cases.
```

## Pull Request Process

### 1. Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass (when available)
- [ ] Documentation updated (if needed)
- [ ] No TypeScript errors
- [ ] Feature is tested manually

### 2. Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing
- [ ] Tested manually
- [ ] Added/updated tests
- [ ] All tests pass

## Screenshots
(If applicable)

## Additional Notes
Any additional context or notes for reviewers
```

### 3. Review Process

1. **Automated checks** must pass
2. **Code review** by maintainer
3. **Manual testing** of functionality
4. **Documentation review** (if applicable)
5. **Approval and merge**

## Community Guidelines

### Be Respectful
- Use inclusive language
- Be constructive in feedback
- Help newcomers learn
- Respect different skill levels

### Ask Questions
- Use GitHub Discussions for general questions
- Use Issues for bug reports and feature requests
- Check existing issues before creating new ones
- Provide context and examples

### Help Others
- Answer questions when you can
- Review pull requests
- Share knowledge and experience
- Mentor new contributors

## Getting Help

### Resources
- [Architecture Overview](./architecture.md)
- [Getting Started Guide](./getting-started.md)
- [Module Documentation](../modules/)
- [File References](../files/)

### Communication
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Request Comments**: Code-specific discussions

### Maintainers
Current maintainers can help with:
- Technical questions
- Design decisions
- Review process
- Project direction

Thank you for contributing to Rosh Blog! Your contributions help make this educational project better for everyone.