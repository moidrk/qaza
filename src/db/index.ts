import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

function createDb() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured")
  }

  return drizzle({ client: neon(databaseUrl), schema })
}

type Database = ReturnType<typeof createDb>

let dbInstance: Database | null = null

export function getDb() {
  dbInstance ??= createDb()
  return dbInstance
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb(), prop, receiver)
    return typeof value === "function" ? value.bind(getDb()) : value
  },
})
