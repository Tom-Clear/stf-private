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

STF 依赖 RethinkDB 作为存储组件。推荐使用 [`start.sh`](start.sh) 脚本一键启动，也可以手动启动容器。

### 方式一：使用 `start.sh` 自动启动（推荐）

[`start.sh`](start.sh) 脚本已内置 RethinkDB 容器检查和启动逻辑：

- 自动检测并清理旧的 `rethinkdb` 容器，避免冲突
- 映射端口 `8080`（管理界面）和 `28015`（客户端端口）
- 使用命名卷 `rethinkdb-data` 持久化数据
- 等待 RethinkDB 就绪后再继续后续步骤

直接跳到 [第 5 步](#5-一键启动脚本-startsh) 即可完整启动环境。

### 方式二：手动启动 RethinkDB 容器

```bash
docker run -d \
  --name rethinkdb \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 28015:28015 \
  -v rethinkdb-data:/data \
  rethinkdb:2.4.2 \
  rethinkdb --bind all --cache-size 2048
```

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

> **提示：** 如果频繁进行本地调试，推荐直接使用 [`start.sh`](start.sh) 一键脚本，它会自动完成 RethinkDB 和 ADB 容器的启动、设备连接以及 STF 启动。详见 [第 5 步](#5-一键启动脚本-startsh)。

---

## 5. 一键启动脚本 `start.sh`

[`start.sh`](start.sh) 是为了简化本地开发调试而编写的集成脚本，一次执行即可完成：

1. 检查并选择可用的 Docker 命令（支持 WSL 原生 `docker` 和 Windows `docker.exe`）
2. 启动或复用 `rethinkdb` 容器（端口 `8080`、`28015`）
3. 启动或复用 `adb` 容器（端口 `5037`）
4. 自动连接指定设备
5. 注入常用的 STF 环境变量
6. 启动 STF 本地服务

### 使用方法

```bash
./start.sh [device_ip:port]
```

示例：

```bash
./start.sh 192.168.137.95:5555
```

脚本默认配置如下（可按需修改 [`start.sh`](start.sh) 顶部的配置区）：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `DEVICE_ADDR` | `192.168.137.95:5555` | 默认连接的设备地址 |
| `ADB_HOST` | `host.docker.internal` | STF 连接 ADB Server 的宿主机地址 |
| `ADB_PORT` | `5037` | ADB Server 端口 |
| `ADB_IMAGE` | `devicefarmer/adb:latest` | ADB 容器镜像 |
| `PUBLIC_IP` | `10.18.208.172` | 用于公网访问的 IP（按需修改） |

### 环境变量

脚本启动前会自动注入以下环境变量，以优化本地调试体验：

```bash
STF_PROVIDER_SCREEN_JPEG_QUALITY=20
STF_PROVIDER_SCREEN_GRABBER=minicap-apk
STF_ADMIN_NAME=administrator@fakedomain.com
STF_ADMIN_EMAIL=administrator
STF_PROVIDER_HEARTBEAT_INTERVAL=10000
STF_PROVIDER_BOOT_COMPLETE_TIMEOUT=120000
TZ='America/Los_Angeles'
```

服务启动后，Web UI 默认访问地址为：http://localhost:7100

---

## 6. 使用 `docker-compose.dev.yaml` 开发调试

除了 `start.sh`，项目还提供了 [`docker-compose.dev.yaml`](docker-compose.dev.yaml) 用于容器化开发调试。它包含 `rethinkdb`、`adb`、`stf` 三个服务，并配置了端口映射、持久化卷和常用环境变量。

### 使用前准备

如果之前运行过 `start.sh` 创建了独立的 `adb` 容器，需要先停止并删除，避免 `5037` 端口冲突：

```bash
docker rm -f adb
```

### 启动服务

```bash
# 1. 启动全部服务（后台运行）
docker compose -f docker-compose.dev.yaml up -d

# 2. 连接设备
docker compose -f docker-compose.dev.yaml exec adb adb connect <设备IP:端口>

# 3. 查看 STF 日志
docker compose -f docker-compose.dev.yaml logs -f stf
```

### 停止服务

```bash
docker compose -f docker-compose.dev.yaml down
```

### 主要端口说明

| 端口 | 服务 | 说明 |
| --- | --- | --- |
| `8080` | rethinkdb | RethinkDB 管理界面 |
| `28015` | rethinkdb | RethinkDB 客户端端口 |
| `5037` | adb | ADB Server 端口 |
| `7100` | stf | STF Web UI |
| `7110` | stf | STF WebSocket |
| `7400-7500` | stf | 设备通信端口 |

> **注意：** 使用 `docker-compose.dev.yaml` 时，STF 运行在独立的 `stf` 容器内，需要提前构建好镜像（如 `stf-jhk`），或取消官方镜像 `devicefarmer/stf` 的注释直接使用。

---

## 7. 近期功能更新速览

当前分支（`dev_1.0.1`）在最近迭代中新增了以下功能，本地调试时可以直接体验和验证：

### 7.1 设备断开后重连

- 支持通过 ADB 重新连接已断开设备
- CLI 新增 `--adb-host` 和 `--adb-port` 选项，用于指定外部 ADB Server
- 设备列表中针对离线设备显示**重连按钮**，点击后调用后端接口重连
- 相关接口：`POST /devices/{serial}/reconnect`

### 7.2 截图按钮

- 远程控制面板新增**截图按钮**
- 点击后触发 `sendKeyEvent(301)` 事件，可在设备端实现截图行为
- 使用相机图标并显示“截图”文本提示

### 7.3 设备删除

- 设备列表详情中根据设备状态显示**删除按钮**
- 删除前弹出确认提示框，删除成功后移除对应设备行
- 删除失败时显示错误提示

### 7.4 设备占用

- 设备列表详情中针对可用设备显示**占用按钮**
- 点击后弹出占用弹窗，可输入占用时长并发送占用请求
- 支持确认、取消及键盘快捷键操作

### 7.5 遥控器控制

- 新增 `remote-control` 模块，为无触控设备提供远程控制能力
- 底部标签栏精简为只保留**遥控器**和**日志**，隐藏截图、自动化、高级、文件管理、信息等标签
- 控制面板模块引入中新增遥控器模块依赖
- 遥控器面板支持方向键、确认键等常用控制按钮

### 7.6 设备拓展与语音发送（`voice-sender.js`）

项目新增 [`voice-sender.js`](voice-sender.js) 自定义工具模块，在前端运行时注入和替换部分 UI 能力，与内置功能互补，主要包括：

- **语音发送**：将底部 `Navigation` 面板替换为语音发送输入框，通过 shell 命令将文本发送至设备，并实时反馈发送状态
- **UI 自动化链接**：将 `Clipboard` 面板替换为设备 UI 自动化入口链接，根据设备序列号生成跳转地址
- **设备列表备注**：在设备列表中显示设备备注信息（有备注时显示备注，无备注时显示设备名）
- **底部 Tab 精简**：隐藏截图、自动化、高级、文件管理、信息等重复 Tab，优化界面布局

### 7.7 其他优化与修复

- **默认语言**：调整 STF 默认语言配置
- **设备名称显示**：优化设备列表设备名称显示逻辑，有备注时优先显示备注，无备注时显示设备名，鼠标悬停可查看序列号
- **Docker 构建修复**：修复 Linux 容器中因 CRLF 换行符导致的脚本执行失败问题，确保 `bin/stf` 在容器内正常运行

> 以上功能均为 UI 层新增能力，本地启动 STF 并连接设备后即可在设备列表和远程控制面板中体验。
