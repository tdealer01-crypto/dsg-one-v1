import { Ban, CircleCheck, CircleHelp, CircleX, Clock, TriangleAlert, type LucideIcon } from 'lucide-react';
import { STATUS_TONE_GLOSS, normalizeStatus, toStatusTone, type StatusTone } from '@/lib/dsg/ui/status';

const TONE_STYLE: Record<StatusTone, { Icon: LucideIcon; className: string }> = {
  pass: { Icon: CircleCheck, className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  fail: { Icon: CircleX, className: 'border-red-500/40 bg-red-500/10 text-red-300' },
  blocked: { Icon: Ban, className: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  pending: { Icon: Clock, className: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  review: { Icon: TriangleAlert, className: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  neutral: { Icon: CircleHelp, className: 'border-slate-600/50 bg-slate-700/30 text-slate-300' },
};

type StatusBadgeProps = {
  status: string | null | undefined;
  // Replaces the default "ผ่าน PASS" text, e.g. a Thai word for a build lifecycle state.
  label?: string;
  className?: string;
};

// Colour is never the only signal: every state has an icon and a word. Safe in server components.
export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const tone = toStatusTone(status);
  const { Icon, className: toneClass } = TONE_STYLE[tone];
  const code = normalizeStatus(status);
  const gloss = STATUS_TONE_GLOSS[tone];
  const text = label ?? ([gloss, code].filter(Boolean).join(' ') || 'ไม่ทราบสถานะ');

  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${toneClass} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}
