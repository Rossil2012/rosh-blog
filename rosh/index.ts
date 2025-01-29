import { Kernel, RoshConnection } from "./internal";

let kernel: Kernel | undefined;

export const newKernel = async (): Promise<[Kernel, RoshConnection]> => {
  kernel = await Kernel.newInstance();
  kernel.schedule();
  const connection = await kernel.newConnection();
  return [kernel, connection];
}
