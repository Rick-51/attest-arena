import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// 用户（钱包地址即主键，nonce 用于签名登录）
export const users = sqliteTable('users', {
  wallet: text('wallet').primaryKey(),
  nonce: text('nonce').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
})

// 任务（价格预测 / 链上交互）
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['price_prediction', 'onchain_interaction'] }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  points: integer('points').notNull().default(0),
  startAt: integer('start_at').notNull(), // unix 秒
  endAt: integer('end_at').notNull(), // unix 秒
  correctAnswer: text('correct_answer'), // 价格预测：结算时回填
  status: text('status', { enum: ['draft', 'active', 'closed', 'settled'] }).notNull().default('draft'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
})

// 提交（用户对某任务的答案 / 证明）
export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id),
  wallet: text('wallet').notNull(),
  teamId: integer('team_id').notNull(),
  answer: text('answer').notNull(),
  points: integer('points').notNull().default(0),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
  attestationId: text('attestation_id'), // bytes32 存证 ID（hex）
  txHash: text('tx_hash'), // addScore 上链交易哈希
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
})
