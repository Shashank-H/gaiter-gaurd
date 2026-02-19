// Database schema definitions using Drizzle ORM

import { pgTable, integer, varchar, timestamp, text, index, boolean, uniqueIndex, real } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

// Refresh tokens table
export const refreshTokens = pgTable('refresh_tokens', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer()
    .references(() => users.id)
    .notNull(),
  tokenHash: varchar({ length: 255 }).notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
}));

// Services table - stores API service configurations
export const services = pgTable('services', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer()
    .references(() => users.id)
    .notNull(),
  name: varchar({ length: 255 }).notNull(),
  baseUrl: varchar({ length: 512 }).notNull(),
  authType: varchar({ length: 50 }).notNull(), // 'api_key', 'bearer', 'basic', 'oauth2'
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('services_user_id_idx').on(table.userId),
}));

// Credentials table - stores encrypted API credentials
export const credentials = pgTable('credentials', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  key: varchar({ length: 255 }).notNull(), // e.g., 'api_key', 'username', 'password'
  encryptedValue: text().notNull(), // format: iv:authTag:ciphertext
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('credentials_service_id_idx').on(table.serviceId),
}));

// Documentation table - stores API documentation
export const documentation = pgTable('documentation', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar({ length: 50 }).notNull(), // 'openapi', 'markdown', 'url'
  title: varchar({ length: 255 }), // optional display title
  content: text().notNull(), // JSON string for OpenAPI, markdown text, or URL string
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('documentation_service_id_idx').on(table.serviceId),
}));

// Agents table - stores AI agent identities with API keys
export const agents = pgTable('agents', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer()
    .references(() => users.id)
    .notNull(),
  name: varchar({ length: 255 }).notNull(), // human-readable agent name
  keyHash: varchar({ length: 64 }).notNull().unique(), // SHA-256 hex digest
  keyPrefix: varchar({ length: 16 }).notNull(), // first 12 chars of key for display
  isActive: boolean().default(true).notNull(), // soft revocation flag
  lastUsedAt: timestamp(), // track last request
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('agents_user_id_idx').on(table.userId),
  keyHashIdx: uniqueIndex('agents_key_hash_idx').on(table.keyHash),
}));

// Agent services table - many-to-many join between agents and services
export const agentServices = pgTable('agent_services', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  agentIdIdx: index('agent_services_agent_id_idx').on(table.agentId),
  serviceIdIdx: index('agent_services_service_id_idx').on(table.serviceId),
  uniquePair: uniqueIndex('agent_services_unique_pair_idx').on(table.agentId, table.serviceId),
}));

// Idempotency keys table - stores idempotency keys with cached responses
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  key: varchar({ length: 255 }).notNull(),
  requestHash: varchar({ length: 64 }).notNull(), // SHA-256 hex of method+url+body
  status: varchar({ length: 20 }).notNull(), // 'processing', 'completed', 'failed'
  responseStatus: integer(),
  responseHeaders: text(), // JSON-serialized response headers
  responseBody: text(),
  createdAt: timestamp().defaultNow().notNull(),
  completedAt: timestamp(),
  expiresAt: timestamp().notNull(), // 24 hour TTL from creation
}, (table) => ({
  uniqueAgentKey: uniqueIndex('idempotency_keys_agent_key_idx').on(table.agentId, table.key),
  expiresAtIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
}));

// Proxy requests table - audit log for proxy request lifecycle
export const proxyRequests = pgTable('proxy_requests', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  idempotencyKeyId: integer()
    .references(() => idempotencyKeys.id),
  method: varchar({ length: 10 }).notNull(),
  targetUrl: varchar({ length: 2048 }).notNull(),
  intent: varchar({ length: 500 }).notNull(),
  requestedAt: timestamp().defaultNow().notNull(),
  completedAt: timestamp(),
  statusCode: integer(),
  errorMessage: text(),
}, (table) => ({
  agentIdIdx: index('proxy_requests_agent_id_idx').on(table.agentId),
  serviceIdIdx: index('proxy_requests_service_id_idx').on(table.serviceId),
  requestedAtIdx: index('proxy_requests_requested_at_idx').on(table.requestedAt),
}));

// Approval queue table - stores risk-flagged requests awaiting human approval
export const approvalQueue = pgTable('approval_queue', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  // UUID v4 generated in app code via crypto.randomUUID() — no pgcrypto dependency
  actionId: varchar({ length: 36 }).notNull().unique(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),

  // Stored request — auth headers stripped before storage; credentials re-injected at execution
  method: varchar({ length: 10 }).notNull(),
  targetUrl: varchar({ length: 2048 }).notNull(),
  requestHeaders: text(), // JSON-serialized, auth headers stripped
  requestBody: text(),    // nullable
  intent: varchar({ length: 500 }).notNull(),

  // Risk assessment result
  riskScore: real().notNull(),          // 0-1 float; PostgreSQL REAL (4-byte), sufficient for risk scores
  riskExplanation: text().notNull(),

  // 5-state machine: PENDING | APPROVED | DENIED | EXPIRED | EXECUTED
  status: varchar({ length: 20 }).notNull().default('PENDING'),

  // TTL: set when status flips to APPROVED; if not executed by this time, status → EXPIRED
  approvalExpiresAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
  resolvedAt: timestamp(), // when APPROVED or DENIED
  executedAt: timestamp(), // when EXECUTED

  // Cached execution result (set after EXECUTED)
  responseStatus: integer(),
  responseHeaders: text(), // JSON-serialized
  responseBody: text(),
}, (table) => ({
  actionIdIdx: uniqueIndex('approval_queue_action_id_idx').on(table.actionId),
  agentIdIdx: index('approval_queue_agent_id_idx').on(table.agentId),
  statusIdx: index('approval_queue_status_idx').on(table.status),
  createdAtIdx: index('approval_queue_created_at_idx').on(table.createdAt),
}));

// Export inferred types for type-safe queries
export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;
export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type InsertRefreshToken = InferInsertModel<typeof refreshTokens>;
export type Service = InferSelectModel<typeof services>;
export type InsertService = InferInsertModel<typeof services>;
export type Credential = InferSelectModel<typeof credentials>;
export type InsertCredential = InferInsertModel<typeof credentials>;
export type Documentation = InferSelectModel<typeof documentation>;
export type InsertDocumentation = InferInsertModel<typeof documentation>;
export type Agent = InferSelectModel<typeof agents>;
export type InsertAgent = InferInsertModel<typeof agents>;
export type AgentService = InferSelectModel<typeof agentServices>;
export type InsertAgentService = InferInsertModel<typeof agentServices>;
export type IdempotencyKey = InferSelectModel<typeof idempotencyKeys>;
export type InsertIdempotencyKey = InferInsertModel<typeof idempotencyKeys>;
export type ProxyRequest = InferSelectModel<typeof proxyRequests>;
export type InsertProxyRequest = InferInsertModel<typeof proxyRequests>;
export type ApprovalQueueEntry = InferSelectModel<typeof approvalQueue>;
export type InsertApprovalQueueEntry = InferInsertModel<typeof approvalQueue>;
