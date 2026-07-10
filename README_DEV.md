# 本地调试 STF

本文档介绍在本地环境（Windows + WSL2）下调试 STF 的完整流程。

---

## 1. 启动 WSL Ubuntu 系统

在 Windows 中启动 WSL Ubuntu 环境：

```powershell
wsl -d Ubuntu-22.04
```

也可以直接在 Qoder 等 IDE 中打开 Ubuntu 终端控制台，如下图所示：

![WSL Ubuntu 终端](image.png)

---

## 2. 启动数据库 RethinkDB

在 Docker 镜像中启动 RethinkDB 数据库服务（STF 依赖的存储组件）。

---

## 3. 使用 ADB 连接终端设备

根据 ADB 服务的运行位置不同，主要有以下三种连接方式。

### 方式一：Ubuntu 系统内运行 ADB

**链路：** `STF → ADB（Ubuntu 系统内） → 本地设备`

**步骤：**

1. **Windows 侧先连接 USB**

   ```powershell
   adb devices
   ```
   确认设备已连接。

2. **开启设备的网络 ADB**

   ```powershell
   adb tcpip 5555
   ```

3. **查看设备 IP**

   ```powershell
   adb shell ip route
   ```
   或在手机的 `设置 → 关于手机 → 状态信息 → IP 地址` 中查看。

4. **在 WSL2 中连接设备**

   ```bash
   adb connect <设备IP>:5555
   adb devices
   ```

   示例：

   ```bash
   adb connect 192.168.1.105:5555
   ```

---

### 方式二：Windows 端运行 ADB Server（推荐，最简单）

**链路：** `STF → ADB（Windows 系统内） → 本地设备`

**步骤：**

1. **在 Windows PowerShell 中启动 ADB Server 并监听所有接口**

   ```powershell
   adb kill-server
   adb -a -P 5037 nodaemon server
   ```
   > `-a` 参数让 ADB Server 监听所有接口，允许 WSL 接入。

2. **另开一个 Windows PowerShell 连接设备**

   ```powershell
   adb connect 192.168.137.95:5555
   ```

3. **获取 WSL2 中可访问的 Windows 主机 IP**

   ```bash
   # 在 WSL 中执行
   cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
   ```
   假设输出为 `172.x.x.1`。

4. **在 WSL 中启动 STF，指向 Windows ADB Server**

   ```bash
   npm run local -- --adb-host 172.x.x.1 --adb-port 5037 --allow-remote
   ```

> 这样 STF 的所有 ADB shell 连接走的是 WSL → Windows 的稳定本地通道，而 Windows ADB Server 自身维护到设备的 TCP 连接。

---

### 方式三：Docker 内运行 ADB 容器

**链路：** `STF → ADB（Docker 镜像内） → 本地设备`

**步骤：**

1. **启动 ADB 容器**

   ```bash
   docker run -d --name adb --restart unless-stopped -p 5037:5037 devicefarmer/adb:latest
   ```

2. **在容器内连接设备**

   ```bash
   docker exec adb adb connect 192.168.137.95:5555
   ```
   输出：设备连接成功。

3. **验证设备状态**

   ```bash
   docker exec adb adb devices
   ```
   确认只有目标设备，没有模拟器干扰。

4. **在 WSL 中启动 STF，连接 Docker 的 ADB 容器**

   端口已映射到 `localhost:5037`：

   ```bash
   npm run local -- --adb-host host.docker.internal --adb-port 5037 --allow-remote
   ```

---

## 4. STF 启动命令

根据上述 ADB 使用方式，STF 对应的启动命令如下：

- **方式一（对应 Ubuntu 内 ADB）：**

  ```bash
  npm run local -- --allow-remote
  ```

- **方式二（对应 Windows ADB Server）：**

  ```bash
  npm run local -- --adb-host 172.x.x.1 --adb-port 5037 --allow-remote
  ```

- **方式三（对应 Docker ADB 容器）：**

  ```bash
  npm run local -- --adb-host host.docker.internal --adb-port 5037 --allow-remote
  ```
