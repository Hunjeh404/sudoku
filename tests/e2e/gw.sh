#!/bin/sh
# 게이트웨이 재시작(pid 파일 사용)
[ -f /tmp/gw.pid ] && kill $(cat /tmp/gw.pid) 2>/dev/null
for p in $(pgrep -f "tsx tests/e2e/gateway"); do [ "$p" != "$$" ] && kill $p 2>/dev/null; done
sleep 1
DB=${DB:-olympus_e2e} nohup node --import tsx tests/e2e/gateway.ts > /tmp/gw.log 2>&1 &
echo $! > /tmp/gw.pid
sleep 2; cat /tmp/gw.log
