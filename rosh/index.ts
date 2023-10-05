import { Kernel, RoshConnection } from "./internal";

let kernel: Kernel | undefined;

export const getKernel = async (): Promise<Kernel> => {
  if (!kernel) {
    kernel = await Kernel.getInstance();
    kernel.schedule();
  }
  return kernel;
}

export const newConnection = async (kernel: Kernel): Promise<RoshConnection> => {
  return kernel.newConnection();
}