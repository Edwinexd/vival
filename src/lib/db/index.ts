import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost:5432/prog2review";

let sql: postgres.Sql | null = null;

export function getDb(): postgres.Sql {
  if (!sql) {
    sql = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      transform: {
        undefined: null,
      },
    });
  }

  return sql;
}

export async function closeDbConnection(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

export { sql };
export default getDb;
