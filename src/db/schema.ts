import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/** کاربران (مدیر / کاربر عادی) */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin | user
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** قالب‌های قرارداد */
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** قراردادهای صادر شده */
export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    title: text("title").notNull(),
    templateId: integer("template_id"),
    customerId: integer("customer_id").notNull(),
    bodyHtml: text("body_html").notNull(),
    status: text("status").notNull().default("sent"), // sent | signed | rejected
    source: text("source").notNull().default("admin"), // admin | shop
    orderId: integer("order_id"),
    docHash: text("doc_hash"),
    createdBy: integer("created_by"),
    issuedAt: timestamp("issued_at").notNull().defaultNow(),
    signedAt: timestamp("signed_at"),
  },
  (t) => [index("contracts_customer_idx").on(t.customerId), index("contracts_status_idx").on(t.status)],
);

/** امضاکنندگان به ترتیب امضا */
export const contractSigners = pgTable(
  "contract_signers",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").notNull(),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    userId: integer("user_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | signed | rejected
    signedAt: timestamp("signed_at"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    signatureFile: text("signature_file"),
    signatureMethod: text("signature_method"), // draw | upload
    otpVerifiedAt: timestamp("otp_verified_at"),
    mobile: text("mobile"),
  },
  (t) => [index("signers_contract_idx").on(t.contractId), index("signers_user_idx").on(t.userId)],
);

/** کدهای یک‌بارمصرف */
export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  signerId: integer("signer_id").notNull(),
  userId: integer("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** لاگ تغییرات و شناسنامه دیجیتال */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id"),
    userId: integer("user_id"),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_contract_idx").on(t.contractId)],
);

/** صندوق ارتباطات: ایمیل و پیامک */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // email | sms
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("logged"), // sent | logged | failed
  error: text("error"),
  contractId: integer("contract_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** محصولات / خدمات متصل به قرارداد (شبیه ووکامرس) */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull().default(0),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  amount: integer("amount").notNull().default(0),
  status: text("status").notNull().default("awaiting_signature"), // awaiting_signature | completed
  contractId: integer("contract_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});
