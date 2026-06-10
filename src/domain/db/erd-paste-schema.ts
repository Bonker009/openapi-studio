import { erdMaxDdlBytes, erdMaxTables } from "@/domain/db/erd-security";

export type ErdPasteFormat = "postgres" | "prisma" | "drizzle";

export type ErdPasteFormatMeta = {
  id: ErdPasteFormat;
  label: string;
  liamFormat: string;
  inputBasename: string;
  placeholder: string;
  example: string;
};

export const ERD_PASTE_FORMATS: ErdPasteFormatMeta[] = [
  {
    id: "postgres",
    label: "PostgreSQL",
    liamFormat: "postgres",
    inputBasename: "schema.sql",
    placeholder: "CREATE TABLE users (\n  id uuid PRIMARY KEY,\n  email text NOT NULL\n);",
    example: `CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL
);`,
  },
  {
    id: "prisma",
    label: "Prisma",
    liamFormat: "prisma",
    inputBasename: "schema.prisma",
    placeholder: "model User {\n  id String @id\n}",
    example: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    String @id @default(uuid())
  email String @unique
  posts Post[]
}

model Post {
  id     String @id @default(uuid())
  title  String
  userId String
  user   User   @relation(fields: [userId], references: [id])
}`,
  },
  {
    id: "drizzle",
    label: "Drizzle",
    liamFormat: "drizzle",
    inputBasename: "schema.ts",
    placeholder: "export const users = pgTable('users', { ... });",
    example: `import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
});`,
  },
];

const FORMAT_SET = new Set<string>(ERD_PASTE_FORMATS.map((f) => f.id));

export function isErdPasteFormat(value: string): value is ErdPasteFormat {
  return FORMAT_SET.has(value);
}

export function getErdPasteFormatMeta(format: ErdPasteFormat): ErdPasteFormatMeta {
  const meta = ERD_PASTE_FORMATS.find((f) => f.id === format);
  if (!meta) throw new Error(`Unknown ERD paste format: ${format}`);
  return meta;
}

const POSTGRES_DANGEROUS_PATTERNS = [
  /\bcopy\s+.+\s+from\s+program\b/i,
  /\bpg_read_file\s*\(/i,
  /\bpg_ls_dir\s*\(/i,
  /\blo_import\s*\(/i,
  /\blo_export\s*\(/i,
  /\bdblink\s*\(/i,
  /\bpg_execute_server_program\b/i,
];

export function estimateEntityCount(content: string, format: ErdPasteFormat): number {
  switch (format) {
    case "postgres": {
      const matches = content.match(/\bcreate\s+table\b/gi);
      return matches?.length ?? 0;
    }
    case "prisma": {
      const matches = content.match(/^\s*model\s+\w+/gm);
      return matches?.length ?? 0;
    }
    case "drizzle": {
      const matches = content.match(/\b(?:pg|sqlite|mysql)Table\s*\(/g);
      return matches?.length ?? 0;
    }
    default:
      return 0;
  }
}

export function sanitizePastedSchema(content: string, format: ErdPasteFormat): void {
  if (format !== "postgres") return;
  for (const pattern of POSTGRES_DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error("PostgreSQL schema contains disallowed statements for ERD parsing");
    }
  }
}

export function validatePastedSchema(input: {
  content: string;
  format: ErdPasteFormat;
}): { content: string; tableCount: number } {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Schema content is required");
  }

  const byteLength = Buffer.byteLength(content, "utf8");
  const maxBytes = erdMaxDdlBytes();
  if (byteLength > maxBytes) {
    throw new Error(
      `Schema is ${byteLength} bytes; limit is ${maxBytes} bytes (LIAM_ERD_MAX_DDL_BYTES)`
    );
  }

  sanitizePastedSchema(content, input.format);

  const tableCount = estimateEntityCount(content, input.format);
  if (tableCount === 0) {
    throw new Error(
      input.format === "postgres"
        ? "No CREATE TABLE statements found"
        : input.format === "prisma"
          ? "No Prisma model definitions found"
          : "No Drizzle table definitions found"
    );
  }

  const maxTables = erdMaxTables();
  if (tableCount > maxTables) {
    throw new Error(
      `Schema has ${tableCount} tables; ERD limit is ${maxTables}. Narrow scope or raise LIAM_ERD_MAX_TABLES.`
    );
  }

  return { content, tableCount };
}
