#!/usr/bin/env bash
# 在这台 Mac mini 上以 Web 服务模式启动 claude-devtools，供局域网其他机器用浏览器访问。
# 用法：./serve-lan.sh          # 启动（已在跑则只打印地址）
#       ./serve-lan.sh stop     # 停止
#       ./serve-lan.sh rebuild  # 改过代码后重建再启动
# 说明：standalone 模式默认绑 0.0.0.0:3456，无鉴权——只在可信网络用。
#       用 caffeinate 包着是因为这台机空闲 1 分钟就睡，睡了服务就不可达。
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-3456}"
LOG="${LOG:-$HOME/claude-devtools.log}"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<本机IP>")

case "${1:-}" in
  stop)
    pkill -f "dist-standalone/index.cjs" && echo "已停止" || echo "没有在跑的服务"; exit 0 ;;
  rebuild)
    pkill -f "dist-standalone/index.cjs" 2>/dev/null || true
    env -u HTTP_PROXY -u HTTPS_PROXY pnpm standalone:build ;;
esac

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 已有服务在监听：http://$IP:$PORT"; exit 0
fi
[ -f dist-standalone/index.cjs ] || { echo "未构建，先构建…"; env -u HTTP_PROXY -u HTTPS_PROXY pnpm standalone:build; }

HOST=0.0.0.0 PORT="$PORT" NODE_ENV=production \
  nohup caffeinate -dimsu node dist-standalone/index.cjs >> "$LOG" 2>&1 &
disown
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sS --noproxy '*' -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null && break
  perl -e 'select(undef,undef,undef,0.5)'
done
if curl -sS --noproxy '*' -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo "✅ 已启动：其他机器打开 http://$IP:$PORT   （本机 http://localhost:${PORT}，日志 ${LOG}）"
else
  echo "🔴 启动失败，看日志：$LOG"; exit 1
fi
