import { z } from "zod";

/**
 * UUID schema for Recepia.
 *
 * Validates the UUID FORMAT (8-4-4-4-12 hex) but NOT the RFC 4122 version.
 * Zod v4 .uuid() rejects UUIDs that don't match RFC 4122 versions 1-8
 * (third group must start with 1-8), which is stricter than PostgreSQL's
 * uuid type. Our seed data uses synthetic UUIDs like 00000000-0000-0000-0000-000000000XXX
 * that PostgreSQL accepts but Zod v4 .uuid() rejects.
 *
 * Use uuidSchema instead of z.string().uuid() everywhere in this codebase.
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "ID inválido",
  );
