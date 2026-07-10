#!/bin/bash
# STF 本地开发启动脚本
# 用法: ./start.sh [device_ip:port]
# 示例: ./start.sh 192.168.137.95:5555

set -e

# ============ 配置区（按需修改） ============
DEVICE_ADDR="${1:-192.168.137.95:5555}"
ADB_HOST="host.docker.internal"
ADB_PORT="5037"
ADB_CONTAINER="adb"
ADB_IMAGE="devicefarmer/adb:latest"
PUBLIC_IP="10.18.208.172"
# ==========================================

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERR ]${NC} $*"; }

# ----- 1. 检查 docker 命令是否可用（用 docker info 验证，而非 command -v） -----
if docker info &>/dev/null; then
  DOCKER=docker
elif docker.exe info &>/dev/null; then
  DOCKER=docker.exe
  info "使用 Windows 上的 docker.exe（WSL 集成未启用）"
else
  error "找不到可用的 docker 命令，请确保 Docker Desktop 已启动"
  error "如果 WSL 集成未启用，请在 Docker Desktop 设置中开启"
  exit 1
fi

# ----- 2. 确保 ADB 容器运行 -----
if [ "$($DOCKER ps -q -f name=^${ADB_CONTAINER}$)" ]; then
  info "ADB 容器已在运行"
else
  if [ "$($DOCKER ps -aq -f name=^${ADB_CONTAINER}$)" ]; then
    info "清理旧的 ADB 容器..."
    $DOCKER rm -f "$ADB_CONTAINER" >/dev/null
  fi
  info "启动 ADB 容器..."
  $DOCKER run -d \
    --name "$ADB_CONTAINER" \
    --restart unless-stopped \
    -p ${ADB_PORT}:5037 \
    -e PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/platform-tools \
    "$ADB_IMAGE" \
    adb -a -P 5037 server nodaemon >/dev/null
  info "等待 ADB server 就绪..."
  sleep 2
fi

# ----- 3. 连接设备 -----
info "连接设备 $DEVICE_ADDR ..."
$DOCKER exec "$ADB_CONTAINER" adb connect "$DEVICE_ADDR" || {
  error "连接设备失败，请检查设备 IP 和网络"
  exit 1
}

sleep 1

# ----- 4. 显示已连接设备 -----
info "当前 ADB 设备列表："
$DOCKER exec "$ADB_CONTAINER" adb devices

# ----- 5. 设置环境变量 -----
export STF_PROVIDER_SCREEN_JPEG_QUALITY=20
export STF_PROVIDER_SCREEN_GRABBER=minicap-apk
export STF_ADMIN_NAME=administrator@fakedomain.com
export STF_ADMIN_EMAIL=administrator
export STF_PROVIDER_HEARTBEAT_INTERVAL=10000
export STF_PROVIDER_BOOT_COMPLETE_TIMEOUT=120000
# export LOG_LEVEL=warn
export TZ='America/Los_Angeles'

info "已注入环境变量："
env | grep -E "^(STF_|LOG_LEVEL|TZ)=" | sed 's/^/  /'

# ----- 6. 启动 STF -----
info "启动 STF (adb-host=$ADB_HOST:$ADB_PORT)..."
info "Web UI 将在 http://localhost:7100 提供访问"
echo ""

exec npm run local -- \
  --adb-host "$ADB_HOST" \
  --adb-port "$ADB_PORT" \
  --allow-remote
