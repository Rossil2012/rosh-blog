---
title: 配置EDK2环境（Ubuntu 22.04）
date: 2023-01-16 20:51:11
---

# 配置EDK2环境（Ubuntu 22.04）

## 安装依赖
```shell
sudo apt-get install -y make gcc uuid-dev g++ sl nasm iasl git
```

其中使用apt安装的 ***nasm*** 可能会有版本过低的问题。在 **edk2/BaseTools/Conf/tools_def.template** 中要求的版本如下：

```text
####################################################################################
#
# Other Supported Tools
# =====================
#   NASM -- http://www.nasm.us/
#   - NASM 2.15.05 or later for use with the GCC toolchain family
#   - NASM 2.15.05 or later for use with all other toolchain families
#
####################################################################################
```

查看nasm版本：
```shell
nasm -v
# NASM version 2.15.05
```

如果版本过低，需要自行安装([版本链接](https://www.nasm.us/pub/nasm/releasebuilds/))，我这里选了2.16.01版本：
```shell
wget https://www.nasm.us/pub/nasm/releasebuilds/2.16.01/nasm-2.16.01.tar.gz
tar -zxvf nasm-2.16.01.tar.gz
cd nasm-2.16.01
./configure 
make 
sudo make install
```

再次查看nasm版本：
```shell
nasm -v
# NASM version 2.16.01 compiled on Jan 16 2023
```

## 编译EDK2源码

clone指定的[release版本](https://github.com/tianocore/edk2/releases)，我选择的是edk2-stable202211。
```shell
git clone -b edk2-stable202211 --recursive https://github.com/tianocore/edk2.git
```

编译EDK2：
```shell
cd edk2
make -C BaseTools
```

注意编译BaseTools的时候，最后的测试需要环境变量中的Python版本为Python3（根据自己的环境决定要不要执行下面的命令）：
```shell
python --version                                # 查看Python版本
sudo apt-get install python3                    # 安装Python3
sudo ln -sf /usr/bin/python3 /usr/bin/python    # 这会覆盖掉原来环境变量中的python，建议备份一下，编译完BaseTools后还原
```

然后执行以下命令：
```shell
. edksetup.sh BaseTools
```

在 **edk2/Conf/target.txt** 中找到如下几行并修改：

```text
ACTIVE_PLATFORM  = OvmfPkg/OvmfPkgX64.dsc
TARGET_ARCH      = X64
TOOL_CHAIN_TAG   = GCC5
```

然后编译EDK2：
```shell
build
```

如果没有修改target.txt文件，可以使用以下命令来指定工具链、目标架构和Platform：
```shell
build -t GCC5 -a X64 -p OvmfPkg/OvmfPkgX64.dsc
```

因为我是在M1 Max的MacBook Pro上用Parallel Desktop虚拟机跑的Arm版本的Ubuntu 22.04，所以GCC目标平台是ARM，而我们需要将OVMF编译成X64架构的binary，因此需要安装交叉编译的GCC工具链。如果你的Ubuntu本来就是跑在X86-64下的话可以跳过。

安装交叉编译工具链：
```shell
sudo apt-get install gcc-x86-64-linux-gnu
```

编译：
```shell
export GCC5_BIN=x86_64-linux-gnu-
build
```

出现以下信息说明编译成功：

```text
FV Space Information
SECFV [24%Full] 212992 (0x34000) total, 51568 (0xc970) used, 161424 (0x27690) free
PEIFV [29%Full] 917504 (0xe0000) total, 274920 (0x431e8) used, 642584 (0x9ce18) free
DXEFV [35%Full] 12582912 (0xc00000) total, 4510824 (0x44d468) used, 8072088 (0x7b2b98) free
FVMAIN_COMPACT [36%Full] 3440640 (0x348000) total, 1271624 (0x136748) used, 2169016 (0x2118b8) free

- Done -
Build end time: 19:49:25, Jan.16 2023
Build total time: 00:01:30
```

需要注意的是，每次重新打开shell编译代码时，都需要执行下面的指令来配置环境变量，然后才能build：
```shell
# export GCC5_BIN=x86_64-linux-gnu- # 交叉编译的话需要设置这个环境变量
. edksetup.sh BaseTools
build
```

## 使用QEMU模拟UEFI环境

安装X86-64的QEMU：
```shell
sudo apt-get install qemu-system-x86
```

QEMU版本过低可能会出错，如果出现问题，可以更新到和我使用的 *6.2.0* 相同或更新的版本。
```shell
qemu-system-x86_64 --version
# QEMU emulator version 6.2.0 (Debian 1:6.2+dfsg-2ubuntu6.6)
```

在edk2文件夹外新建一个目录 **run-ovmf** ，在里面放入启动脚本。

```shell
mkdir run-ovmf
cd run-ovmf
mkdir hda-contents
echo qemu-system-x86_64 -pflash bios.bin -hda fat:rw:hda-contents -net none -debugcon file:debug.log -global isa-debugcon.iobase=0x402 -nographic > RunQemu.sh
cp ../edk2/Build/OvmfX64/DEBUG_GCC5/FV/OVMF.fd bios.bin
touch hda-contents/testfile # 测试fs0文件系统
```

最终目录结构如下：
```text
edk2\
run-ovmf\
    ├── RunQemu.sh
    ├── bios.bin
    ├── debug.log
    └── hda-contents
        └── testfile

```

其中 ***RunQemu.sh*** 是启动脚本， ***bios.bin*** 是编译好的固件，***debug.log*** 是Debug输出（运行一次RunQemu.sh后才会出现），***hda-contents*** 文件夹对应UEFI Shell中的 **fs0** 文件系统，后续可以将编译好的 **.efi** 文件拷贝到这里。

启动OVMF：
```shell
. RunQemu.sh
```

看到如下信息，且 **ls** 命令能看到 **testfile** 说明成功运行：
```text
UEFI Interactive Shell v2.2
EDK II
UEFI v2.70 (EDK II, 0x00010000)
Mapping table
      FS0: Alias(s):HD0a1:;BLK1:
          PciRoot(0x0)/Pci(0x1,0x1)/Ata(0x0)/HD(1,MBR,0xBE1AFDFA,0x3F,0xFBFC1)
     BLK0: Alias(s):
          PciRoot(0x0)/Pci(0x1,0x1)/Ata(0x0)
     BLK2: Alias(s):
          PciRoot(0x0)/Pci(0x1,0x1)/Ata(0x0)
Press ESC in 1 seconds to skip startup.nsh or any other key to continue.
Shell> fs0:
FS0:\> ls
Directory of: FS0:\
01/16/2023  20:33                   0  testfile
          1 File(s)           0 bytes
          0 Dir(s)
FS0:\> 
```

恭喜你，你已经完成EDK2环境的搭建了！



