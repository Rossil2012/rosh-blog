export class Chan<T> {
  private queue_: T[];
  private bufferSize_: number;
  private pendingGets_: Array<(item: T | typeof Chan.CLOSED) => void>;
  private pendingPuts_: Array<{item: T, resolve: (value: typeof Chan.CLOSED | typeof Chan.SUCCESS) => void}>;
  private isClosed_: boolean;

  static CLOSED = Symbol('CLOSED');
  static SUCCESS = Symbol('SUCCESS');
  static FAILED = Symbol('FAILED');

  constructor(bufferSize?: number) {
    this.queue_ = [];
    this.bufferSize_ = bufferSize && bufferSize > 0 ? bufferSize : Infinity;
    this.pendingGets_ = [];
    this.pendingPuts_ = [];
    this.isClosed_ = false;
  }

  close() {
    this.isClosed_ = true;

    while (this.pendingGets_.length > 0) {
      const getResolve = this.pendingGets_.shift()!;
      getResolve(Chan.CLOSED);
    }

    while (this.pendingPuts_.length > 0) {
      const { resolve: putResolve } = this.pendingPuts_.shift()!;
      putResolve(Chan.CLOSED);
    }
  }

  isClosed() {
    return this.isClosed_;
  }

  tryGet(): T | typeof Chan.CLOSED | typeof Chan.FAILED {
    if (this.queue_.length > 0) {
      const item = this.queue_.shift()!;
  
      if (this.pendingPuts_.length > 0) {
        const { item: putItem, resolve: putResolve } = this.pendingPuts_.shift()!;
        this.queue_.push(putItem);
        putResolve(Chan.SUCCESS);
      }
  
      return item;
    } else if (this.isClosed_) {
      return Chan.CLOSED;
    } else {
      return Chan.FAILED;
    }
  }
  
  tryPut(item: T): typeof Chan.CLOSED | typeof Chan.SUCCESS | typeof Chan.FAILED {
    if (this.isClosed_) {
      return Chan.CLOSED;
    }
  
    if (this.queue_.length < this.bufferSize_) {
      this.queue_.push(item);
  
      if (this.pendingGets_.length > 0) {
        const getResolve = this.pendingGets_.shift()!;
        getResolve(this.queue_.shift()!);
      }
  
      return Chan.SUCCESS;
    } else {
      return Chan.FAILED;
    }
  }
  

  async put(item: T): Promise<typeof Chan.CLOSED | typeof Chan.SUCCESS> {
    if (this.isClosed_) {
      return Chan.CLOSED;
    }

    return new Promise<typeof Chan.CLOSED | typeof Chan.SUCCESS>((resolve) => {
      if (this.queue_.length < this.bufferSize_) {
        this.queue_.push(item);

        if (this.pendingGets_.length > 0) {
          const getResolve = this.pendingGets_.shift()!;
          getResolve(this.queue_.shift()!);
        }

        resolve(Chan.SUCCESS);
      } else {
        this.pendingPuts_.push({item, resolve});
      }
    });
  }

  async get(): Promise<T | typeof Chan.CLOSED> {
    return new Promise<T | typeof Chan.CLOSED>((resolve) => {
      if (this.queue_.length > 0) {
        const item = this.queue_.shift()!;

        if (this.pendingPuts_.length > 0) {
          const { item: putItem, resolve: putResolve } = this.pendingPuts_.shift()!;
          this.queue_.push(putItem);
          putResolve(Chan.SUCCESS);
        }

        resolve(item);
      } else if (this.isClosed_) {
        resolve(Chan.CLOSED);
      } else {
        this.pendingGets_.push(resolve);
      }
    });
  }
}