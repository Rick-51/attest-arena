# Attest Arena — 后端

Hono + SQLite/Drizzle + viem，跑在 Node 20+。

## 启动步骤

```bash
cd backend
npm install
cp .env.example .env   # 然后编辑 .env 填入 PRIVATE_KEY 和合约地址
npm run db:push        # 初始化 SQLite 表结构
npm run dev            # 启动，默认 http://localhost:3000
```

验证：`curl http://localhost:3000/health`

## 目录结构

```
backend/
├── src/
│   ├── index.ts            # Hono 入口
│   ├── config.ts           # env 配置
│   ├── chains/creditcoin.ts# viem 链定义（chainId 102031）
│   ├── db/
│   │   ├── schema.ts       # Drizzle 表结构
│   │   └── index.ts        # SQLite 连接
│   ├── lib/viem.ts         # publicClient / walletClient
│   └── contracts/
│       ├── abi.ts          # 合约 ABI
│       └── addresses.ts    # 合约地址
└── sqlite.db               # 本地数据库（gitignore）
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `RPC_URL` | Creditcoin 测试网 RPC |
| `CHAIN_ID` | 102031 |
| `PRIVATE_KEY` | 后端钱包私钥（有余额 + 已 `setBackend` 授权） |
| `FACTION_REGISTRY` / `SCORE_ATTESTER` / `PRIZE_POOL` | 部署后回填的合约地址 |

## ⚠️ 部署合约后要做两件事

1. 把三个合约地址回填到 `.env`
2. 用 owner 调 `ScoreAttester.setBackend(后端钱包地址, true)`，后端才能调 `addScore`

## 待补全

- 完整 ABI（含 `getTeamRecord` 等返回 struct 的读函数）从 Remix 复制覆盖 `abi.ts`
- 认证 / 任务 / 提交 / 结算 / 管理 / 排行榜 路由与服务（下一步开发）
