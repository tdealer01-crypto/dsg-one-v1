export type TemplateGoalDraft = { slug: string; name: string; goal: string; criteria: string[]; descriptionTruncated: boolean };

/** The server intake is authoritative. Catalog metadata can only seed editable draft intent. */
function boundedDraftText(value: string, limit: number): string {
  const text = value.trim();
  if (text.length <= limit) return text;
  // JS validators measure UTF-16 length; avoid cutting a surrogate pair in half.
  let prefix = text.slice(0, limit - 1);
  if (/[\uD800-\uDBFF]$/.test(prefix)) prefix = prefix.slice(0, -1);
  return `${prefix.trimEnd()}…`;
}

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
  const name = row.name.trim();
  const prefix = `สร้างแอปจากเทมเพลต ${name}: `;
  // Outcome Intake allows goal <= 800 UTF-16 units and successOutcome <= 600.
  // Prefer an editable preview over a prefilled form that is guaranteed to fail validation.
  const description = row.description.trim();
  const draftDescription = boundedDraftText(description, Math.min(600, 800 - prefix.length));
  return {
    slug: requested,
    name,
    goal: prefix + draftDescription,
    criteria: [draftDescription],
    descriptionTruncated: draftDescription !== description,
  };
}
