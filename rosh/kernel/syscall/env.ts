import { ProcessContext, FcnSyscall, resolvePath, vfs, shallowCopy } from "../../internal"

export const getcwdImpl = async (ctx: ProcessContext): Promise<string> => {
  return ctx.proc.cwd;
}

export const SysGetcwd = () => {
  return new FcnSyscall(getcwdImpl);
}

export const chdirImpl = async (ctx: ProcessContext, path: string): Promise<boolean> => {
  if (!path.startsWith('/')) {
    path = `${ctx.proc.cwd}/${path}`;
  }
  path = `/${resolvePath(path).join('/')}`;

  let success: boolean;
  try {
    success = await vfs.chdir(ctx, path);
    if (success) {
      ctx.proc.cwd = path;
    }
  } catch(err: unknown) {

    console.log('chdir!!', err);
    success = false;
  }

  return success;
}

export const SysChdir = (path: string) => {
  return new FcnSyscall(chdirImpl, path);
}

export const getenvImpl = async (ctx: ProcessContext, name: string): Promise<string | undefined> => {
  return ctx.proc.env[name];
}

export const SysGetenv = (name: string) => {
  return new FcnSyscall(getenvImpl, name);
}

export const setenvImpl = async (ctx: ProcessContext, name: string, value: string, overwrite: boolean): Promise<void> => {
  const envVar = await getenvImpl(ctx, name);
  if (!envVar || overwrite) {
    ctx.proc.env[name] = value;
  }
}

export const SysSetenv = (name: string, value: string, overwrite: boolean) => {
  return new FcnSyscall(setenvImpl, name, value, overwrite);
}

export const unsetenvImpl = async (ctx: ProcessContext, name: string) => {
  delete ctx.proc.env[name];
}

export const SysUnsetenv = (name: string) => {
  return new FcnSyscall(unsetenvImpl, name);
}

export const environmentImpl = async (ctx: ProcessContext): Promise<Record<string, string>> => {
  return shallowCopy(ctx.proc.env);
}

export const SysEnvironment = () => {
  return new FcnSyscall(environmentImpl);
}