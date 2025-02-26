import { Inode, Kernel, KernelBuildArgs, RoshConnection } from "../internal";

export class KernelBuilder {
    private build_args_: KernelBuildArgs;
    private kernel_: Kernel;

    public static default(): KernelBuilder {
        return new KernelBuilder();
    }

    private constructor() {
        this.build_args_ = {};
        this.kernel_ = new Kernel();
    }

    public withMount(path: string, inode: Inode): KernelBuilder {
        if (!this.build_args_.mnt_points) {
            this.build_args_.mnt_points = new Map();
        }
        this.build_args_.mnt_points.set(path, inode);
        return this;
    }

    public async build(): Promise<Kernel> {
        await this.kernel_.init(this.build_args_);
        this.kernel_.schedule();
        return this.kernel_;
    }

    public async buildWithConnection(): Promise<[Kernel, RoshConnection]> {
        const kernel = await this.build();
        const connection = await kernel.newConnection();
        return [kernel, connection];
    }
}