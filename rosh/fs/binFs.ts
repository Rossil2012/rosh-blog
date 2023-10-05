import { Executable, InodeAttr, CoreFile } from '../internal';

export class BinFile extends CoreFile {
  private procT_: Executable;
  constructor(attr: Partial<InodeAttr>, procT: Executable) {
    super(attr);
    this.procT_ = procT;
  }

  getExecutable(): Executable {
    return this.procT_;
  }
}
