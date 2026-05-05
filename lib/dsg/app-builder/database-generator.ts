const ALLOW = /^[a-z][a-z0-9_]{1,62}$/;
export function generateMigration(table: string){ if(!ALLOW.test(table)) throw new Error('TABLE_NOT_ALLOWED'); return `create table if not exists ${table} (id uuid primary key);`; }
