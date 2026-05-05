import { describe,it,expect } from 'vitest';
import { generateMigration } from '@/lib/dsg/app-builder/database-generator';
import { generateCrudSpec } from '@/lib/dsg/app-builder/crud-generator';
describe('db crud',()=>{it('deterministic',()=>expect(generateMigration('tasks')).toBe(generateMigration('tasks')));it('opsครบ',()=>expect(generateCrudSpec('tasks').ops).toEqual(['create','read','update','delete']));});
