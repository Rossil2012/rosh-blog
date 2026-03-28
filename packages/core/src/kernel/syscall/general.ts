import { FcnSyscall, ProcessContext, sleep } from "../../internal";

export const sleepMsImpl = async (ctx: ProcessContext, ms: number): Promise<void> => {
  return sleep(ms);
}

export const SysSleepMs = (ms: number) => {
  return new FcnSyscall(sleepMsImpl, ms);
}