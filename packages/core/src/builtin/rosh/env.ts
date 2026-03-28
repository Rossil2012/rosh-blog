import { assert, createDefaultRecord, shallowCopy } from "../../internal";

export class Environment {
  private env_: Record<string, EnvVariable>;

  constructor() {
    this.env_ = createDefaultRecord<string, EnvVariable>(() => EnvVariable.fromString(''));
  }

  has(name: string): boolean {
    return Object.hasOwn(this.env_, name);
  }

  names(): string[] {
    return Object.keys(this.env_);
  }

  vars(): EnvVariable[] {
    return Object.values(this.env_);
  }

  get(name: string): EnvVariable {
    return this.env_[name];
  }

  set(name: string, value: EnvVariable): void {
    this.env_[name] = value;
    value.name = name;
  }
}

export class EnvVariable {
  type: 'string' | 'array' | 'associative';
  private name_: string | undefined;
  private sysEnv_: boolean;
  private readonly_: boolean;
  private value_: string | Record<number, EnvVariable> | Record<string, EnvVariable>;

  constructor(type: 'string' | 'array' | 'associative', value: string | Record<number, EnvVariable> | Record<string, EnvVariable>, 
    sysEnv: boolean = false, readonly: boolean = false) {
    this.type = type;
    this.value_ = value;
    this.sysEnv_ = sysEnv;
    this.readonly_ = readonly;
  }

  setReadonly(): void {
    this.readonly_ = true;
  }

  setSysEnv(): void {
    this.sysEnv_ = true;
  }

  isSysEnv(): boolean {
    return this.sysEnv_;
  }

  clear(): void {
    assert(!this.readonly_, `rosh: ${this.name_}: readonly variable`);
    if (this.type === 'string') {
      this.value_ = '';
    } else if (this.type === 'array') {
      this.value_ = createDefaultRecord<number, EnvVariable>(() => EnvVariable.fromString(''));
    } else {
      this.value_ = createDefaultRecord<string, EnvVariable>(() => EnvVariable.fromString(''));
    }
  }

  isString(): boolean {
    return this.type === 'string';
  }

  isArray(): boolean {
    return this.type === 'array';
  }

  isAssociative(): boolean {
    return this.type === 'associative';
  }

  toString(): EnvVariable {
    this.value_ = this.string;
    this.type = 'string';
    return this;
  }

  toArray(): EnvVariable {
    if (this.isString()) {
      const content = this.string;
      this.value_ = createDefaultRecord<number, EnvVariable>(() => EnvVariable.fromString(''));
      (this.value_ as Record<number, EnvVariable>)[0] = EnvVariable.fromString(content);
    }

    this.type = 'array';
    return this;
  }

  toAssociative(): EnvVariable {
    if (this.isString()) {
      const content = this.string;
      this.value_ = createDefaultRecord<string, EnvVariable>(() => EnvVariable.fromString(''));
      (this.value_ as Record<string, EnvVariable>)[''] = EnvVariable.fromString(content);
    }

    this.type = 'associative';
    return this;
  }

  get name() {
    assert(this.name_);
    return this.name_;
  }

  set name(name: string) {
    this.name_ = name;
  }

  get string(): string {
    if (this.isArray()) {
      return (this.value_ as Record<number, EnvVariable>)[0].string;
    } else if (this.isAssociative()) {
      return (this.value_ as Record<string, EnvVariable>)[''].string;
    } else {
      return this.value_ as string;
    }
  }

  set string(value: string) {
    assert(!this.readonly_, `rosh: ${this.name_}: readonly variable`);

    if (this.isArray()) {
      (this.value_ as Record<number, EnvVariable>)[0].string = value;
    } else if (this.isAssociative()) {
      (this.value_ as Record<string, EnvVariable>)[''].string = value;
    } else {
      this.value_ = value;
    }
  }

  get number(): number {
    const num = parseInt(this.string);
    return isNaN(num) ? 0 : num;
  }

  set number(value: number) {
    assert(!this.readonly_, `rosh: ${this.name_}: readonly variable`);
    this.string = String(value);
  }

  get array(): Record<number, EnvVariable> {
    assert(this.type === 'array');
    return this.value_ as Record<number, EnvVariable>;
  }

  set array(value: Record<number, EnvVariable>) {
    assert(!this.readonly_, `rosh: ${this.name_}: readonly variable`);
    this.type = 'array';
    this.value_ = value;
  }

  get associative(): Record<string, EnvVariable> {
    assert(this.type === 'associative');
    return this.value_ as Record<string, EnvVariable>;
  }

  set associative(value: Record<string, EnvVariable>) {
    assert(!this.readonly_, `rosh: ${this.name_}: readonly variable`);
    this.type = 'associative';
    this.value_ = value;
  }

  static from(envVar: EnvVariable) {
    const value = typeof(envVar.value_) === 'object' ? shallowCopy(envVar.value_) : envVar.value_;
    return new EnvVariable(envVar.type, value);
  }

  static fromString(value: string): EnvVariable {
    return new EnvVariable('string', value);
  }

  static fromNumber(value: number): EnvVariable {
    return new EnvVariable('string', String(value));
  }

  static fromArray(value: Record<number, EnvVariable>): EnvVariable {
    const defaultRecord = createDefaultRecord<number, EnvVariable>(() => EnvVariable.fromString(''), value);
    return new EnvVariable('array', defaultRecord);
  }

  static fromAssociative(value: Record<string, EnvVariable>): EnvVariable {
    const defaultRecord = createDefaultRecord<string, EnvVariable>(() => EnvVariable.fromString(''), value);
    return new EnvVariable('associative', defaultRecord);
  }
}
