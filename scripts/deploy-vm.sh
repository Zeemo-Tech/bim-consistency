#!/usr/bin/env bash
# 前端一键重新部署到虚拟机（本地改完代码执行）
#
# 用法：
#   ./scripts/deploy-vm.sh
#
# 做了什么：用项目要求的 Node 20.19.0 构建 dist，然后同步到 VM 的 nginx 静态目录。
# nginx 直接读磁盘上的新文件，无需重启容器，刷新浏览器即可看到更新。
set -euo pipefail

VM="chen@172.16.10.24"
REMOTE_DIR="/home/chen/zhongjian-back/frontend-dist"

# 切到项目要求的 Node 版本（nvm）
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20.19.0 >/dev/null 2>&1 || true

cd "$(dirname "$0")/.."

echo "==> 构建前端 (node $(node -v))"
pnpm build

echo "==> 同步 dist 到 ${VM}:${REMOTE_DIR}"
rsync -az --delete dist/ "${VM}:${REMOTE_DIR}/"

echo "==> 完成，访问 http://172.16.10.24"
