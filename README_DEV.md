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

### 7.6.1 语音环境切换

语音发送面板内置语音环境（测试环境 / 正式环境）切换能力，替代 `tmp/debug_测试环境-语音.bat`、`tmp/debug_正式环境-语音.bat` 手动执行 adb 命令的方式。

- **环境查看**：设备连接就绪后自动读取 `areaurl`、`aicloudurl`、`digitalurl`、`taskmaster_test`、`test_url_llm` 五个 global settings，全部有值为**测试环境**（橙色标签），全部删除为**正式环境**（绿色标签），部分配置为**未知环境**（灰色标签）；鼠标悬停标签可查看具体地址，点击刷新图标可重新查询
- **环境切换**：点击「测试环境」写入五个测试地址，点击「正式环境」删除这五个键回退到设备内置地址，两者都会额外执行 `speech_savelog_file=1`、`setprop foundation_debug 2`
- **重启语音服务**：切换后固定按顺序执行 `pm clear` 清理 `com.keylab.speech.core.vidaa` 等语音应用数据，再拉起 `com.hisense.speech.core.STARTSERVICE`（因为不重启新配置不会生效，故不再提供“只改配置不重启”选项）；由于会清理应用数据，执行前会有二次确认
- 命令按序串行下发，单条失败不中断，结束后以黄色提示失败条数并回查一次最新环境

相关实现：`res/app/control-panes/dashboard/navigation/navigation.pug`、`navigation-controller.js`、`navigation.css`

### 7.7 其他优化与修复

- **控制面板分栏布局**：左侧设备屏幕与右侧控制栏的默认分隔比例调整为 **65:35**（三分律），右侧面板更宽松协调；同时支持记住用户手动拖拽后的屏幕宽度——拖拽结束后以像素值持久化到 `localStorage`（键 `stf.controlPane.remotePaneSize`），下次进入自动恢复，未拖拽过则使用默认 65%。实现见 `res/app/control-panes/control-panes-hotkeys-controller.js`
- **默认语言**：调整 STF 默认语言配置
- **设备名称显示**：优化设备列表设备名称显示逻辑，有备注时优先显示备注，无备注时显示设备名，鼠标悬停可查看序列号
- **Docker 构建修复**：修复 Linux 容器中因 CRLF 换行符导致的脚本执行失败问题，确保 `bin/stf` 在容器内正常运行

> 以上功能均为 UI 层新增能力，本地启动 STF 并连接设备后即可在设备列表和远程控制面板中体验。

## 8. 常见问题（FAQ）

### Q1: STF 启动后设备 worker 反复崩溃，日志提示 `Failed more than 3 times in 10000ms`

**现象**

启动 STF 并连接网络 ADB 设备后，控制台循环出现类似如下错误：

```text
WRN/device:plugins:touch  [xxx.xxx.xxx.xxx:5555] Connection to minitouch ended unexpectedly
INF/device:plugins:touch  [xxx.xxx.xxx.xxx:5555] Launching touch service
INF/device:plugins:touch  [xxx.xxx.xxx.xxx:5555] minitouch says: "Unable to find a suitable touch device"
INF/device:plugins:touch  [xxx.xxx.xxx.xxx:5555] minitouch says: "using Android InputManager"
ERR/device:plugins:touch  [xxx.xxx.xxx.xxx:5555] Touch consumer had an error Error: Failed more than 3 times in 10000ms
FTL/util:lifecycle  [xxx.xxx.xxx.xxx:5555] Shutting down due to fatal error
```

**原因**

通常是**之前某次 STF 实例没有彻底退出**，形成了"僵尸"进程。该残留实例持续占用设备的 ADB 连接，并在设备端保持 `stf.agent` / `minitouch` / `minirev` 等 shell 进程。新启动的 STF 再次连接同一台设备时，会因为 `localabstract:minitouch` socket 被占用而启动失败，失败次数在 10 秒内累积到 3 次即触发 fatal，导致设备 worker 退出。

**验证**

在 ADB 容器中执行：

```bash
docker exec adb adb -s <设备IP>:5555 shell "ps -A | grep -E 'stf.agent|minitouch|minirev'"
```

如果看到相关进程，且手动 `pkill` 后进程又重新出现，即可确认存在残留 STF 实例在拉起这些进程。

**解决方案**

1. 优先尝试彻底清理设备端残留进程：
   ```bash
   docker exec adb adb -s <设备IP>:5555 shell "pkill -9 stf.agent; pkill -9 minitouch; pkill -9 minirev"
   ```

2. 检查并关闭所有可能运行 STF 的终端、IDE 运行任务、WSL 会话等，确保没有残留 node 进程。

3. 若清理后问题依旧，最直接的方案是**重启电脑**，以彻底清除所有残留的 STF 进程和 ADB 连接状态。

**预防**

- 停止 STF 时不要只关闭浏览器或终端窗口，应在启动终端按 `Ctrl+C` 等待所有子进程退出。
- 停止后可通过 `ps -A | grep -E 'stf.agent|minitouch|minirev'` 确认设备端进程已被清理。

## 9. 镜像构建与上线部署

### 9.1 本地构建 Docker 镜像

在项目根目录执行：

```bash
docker build -t stf:<版本号> .
```

示例：

```bash
docker build -t stf:3.7.8 .
```

构建过程会基于 [`Dockerfile`](Dockerfile) 完成以下操作：

- 安装 Node.js、构建工具及运行时依赖
- 执行 `npm install` 与 `npm pack`
- 将产物解压到 `/app` 目录
- 清理开发依赖与临时文件

> 注意：构建耗时较长，请确保网络畅通且 Docker 有足够磁盘空间。

### 9.2 导出镜像为 tar 包

构建成功后，将镜像导出为 tar 文件，便于传输到无外网的服务器：

```bash
docker save -o stf-<版本号>.tar stf:<版本号>
```

示例：

```bash
docker save -o stf-3.7.8.tar stf:3.7.8
```

导出后可通过 `ls -lh` 查看 tar 包大小。

### 9.3 将 tar 包上传到服务器

根据服务器环境选择传输方式，例如 `scp`、`rsync` 或 FTP：

```bash
scp stf-3.7.8.tar user@your-server:/path/to/deploy/
```

### 9.4 服务器导入镜像

登录服务器，进入 tar 包所在目录，执行导入：

```bash
docker load -i stf-3.7.8.tar
```

导入成功后，可通过以下命令确认镜像存在：

```bash
docker images | grep stf
```

### 9.5 服务器运行 STF 容器

#### 方式一：使用 docker-compose（推荐）

参考项目已有的 [`docker-compose.yaml`](docker-compose.yaml)，将 `stf` 服务的镜像替换为刚刚导入的镜像：

```yaml
stf:
  container_name: stf
  image: stf:3.7.8   # 替换为实际版本号
  ports:
    - "7100:7100"
    - "7110:7110"
    - "7400-7500:7400-7500"
  environment:
    - TZ='America/Los_Angeles'
    - RETHINKDB_PORT_28015_TCP=tcp://rethinkdb:28015
    - STF_ADMIN_EMAIL=<YOUR_EMAIL>
    - STF_ADMIN_NAME=<YOUR_NAME>
  restart: unless-stopped
  command: >
    stf local
    --adb-host adb
    --public-ip YOUR_SERVER_IP
    --provider-min-port 7400
    --provider-max-port 7500
```

启动服务：

```bash
docker-compose up -d
```

#### 方式二：使用 docker run 手动启动

```bash
docker run -d \
  --name stf \
  --restart unless-stopped \
  -p 7100:7100 \
  -p 7110:7110 \
  -p 7400-7500:7400-7500 \
  -e TZ='America/Los_Angeles' \
  -e RETHINKDB_PORT_28015_TCP=tcp://<rethinkdb-host>:28015 \
  -e STF_ADMIN_EMAIL=<YOUR_EMAIL> \
  -e STF_ADMIN_NAME=<YOUR_NAME> \
  stf:3.7.8 \
  stf local \
    --adb-host <adb-host> \
    --public-ip <YOUR_SERVER_IP> \
    --provider-min-port 7400 \
    --provider-max-port 7500
```

### 9.6 验证部署

1. 查看容器状态：
   ```bash
   docker ps | grep stf
   ```

2. 查看启动日志：
   ```bash
   docker logs -f stf
   ```

3. 浏览器访问 `http://<YOUR_SERVER_IP>:7100`，确认 STF Web 界面正常。

4. 连接一台测试设备，确认设备列表可正常显示并能进入远程控制面板。
