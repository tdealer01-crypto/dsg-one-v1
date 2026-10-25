export type TemplateGoalDraft = { slug: string; name: string; goal: string; criteria: string[] };

/** Catalog metadata is editable intent, never a validated intake or authority. */
export function templateGoalDraft(payload: unknown, requested: unknown): TemplateGoalDraft {
  if (typeof requested !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(requested)) throw new Error('ลิงก์เทมเพลตไม่ถูกต้อง');
  const body = payload as { ok?: unknown; data?: unknown } | null;
  if (!body || body.ok !== true || !Array.isArray(body.data)) throw new Error('ยังอ่านรายการเทมเพลตไม่ได้');
  const matches = body.data.filter(row => row && typeof row === 'object' && row.slug === requested);
  if (matches.length !== 1) throw new Error('ไม่พบเทมเพลตที่เลือก กรุณาเลือกจากรายการอีกครั้ง');
  const row = matches[0];
  if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 160 ||
      typeof row.description !== 'string' || !row.description.trim() || row.description.length > 1800) throw new Error('ข้อมูลเทมเพลตยังไม่ครบ');
  return { slug: requested, name: row.name, goal: `สร้างแอปจากเทมเพลต ${row.name}: ${row.description}`, criteria: [row.description] };
}
