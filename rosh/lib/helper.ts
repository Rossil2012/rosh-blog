export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed.");
  }
}

export const makeSet = (...args: any[]): Set<any> => {
  return new Set(args);
}

export const findOrPushNullEntry = (arr: Array<any | null>): number => {
  for (let [idx, entry] of arr.entries()) {
    if (entry === null) {
      return idx;
    }
  }

  arr.push(null);
  return arr.length - 1;
}

export const shallowCopy = (obj: any): any => {
  return { ...obj };
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const createDefaultRecord = <K extends PropertyKey, V>(defaultValue: V | (() => V), init?: Record<K, V>): Record<K, V> => {
  const baseRecord = shallowCopy(init ?? {});
  return new Proxy(baseRecord as Record<K, V>, {
    get: function(target: Record<K, V>, property: PropertyKey) {
      if (!Reflect.has(target, property)) {
        target[property as K] = typeof defaultValue === 'function' ? (defaultValue as () => V)() : defaultValue;
      }
      return target[property as K];
    }
  });
}

export const makeSequence = (start: number, end: number): number[] => {
  if (start < end) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
      return Array.from({ length: start - end + 1 }, (_, i) => start - i);
  }
}

export const getAbsPath = (path: string, cwd: string, envPath?: string): string[] => {
  let resolved = [];

  if (path.includes('/')) {
    return path.startsWith('/') ? [path] : [`${cwd}/${path}`];
  }

  if (envPath) {
    for (const dir of envPath.split(':')) {
      resolved.push(`${dir}/${path}`);
    }
  }

  return resolved;
}

export const checkBitFlags = (flags: number, ...toCheck: number[]): boolean => {
  for (const flag of toCheck) {
    if (!(flag & flags)) {
      return false;
    }
  }
  return true;
}

export const resolvePath = (path: string): string[] => {
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
}
