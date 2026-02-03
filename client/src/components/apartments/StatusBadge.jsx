import { Circle } from 'lucide-react';

const statusConfig = {
  WOLNE: { label: 'Wolne', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  WYNAJĘTE: { label: 'Wynajęte', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  REMANENT: { label: 'Remanent', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.REMANENT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}
    >
      <Circle className="w-2 h-2 fill-current" />
      {config.label}
    </span>
  );
}
