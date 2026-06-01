# 真实 Pi JSON event stream trace(已精简)

生成命令: `pi --provider deepseek --model deepseek-v4-flash --mode json --no-session -p "Reply with exactly: ok" </dev/null`
Pi 版本: 0.78.0 | 抓取时间: 2026-06-01 | provider: deepseek (api=openai-completions)

## 事件序列骨架(26 行原始,message_update 已折叠)
```
session
agent_start
turn_start
message_start
message_end
message_start
message_end  [+17 message_update collapsed]
turn_end
agent_end
```

## 关键字段(逐字摘自真实 trace)
```json
{
  "session_header": {
    "type": "session",
    "version": 3,
    "id": "019e818c-22fa-7675-b74a-d5e39749a235"
  },
  "assistant_message_meta": {
    "api": "openai-completions",
    "provider": "deepseek",
    "model": "deepseek-v4-flash",
    "stopReason": "stop"
  },
  "usage": {
    "input": 109,
    "output": 14,
    "cacheRead": 6784,
    "cacheWrite": 0,
    "totalTokens": 6907,
    "cost": {
      "input": 1.526e-05,
      "output": 3.920000000000001e-06,
      "cacheRead": 1.8995199999999997e-05,
      "cacheWrite": 0,
      "total": 3.817519999999999e-05
    }
  },
  "final_event_type": "agent_end",
  "willRetry": false
}
```