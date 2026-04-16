// ─── BADGE ────────────────────────────────────────────────────────────────────
export function Badge({ cls, children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export function ProgressBar({ value = 0, color = 'bg-blue-500' }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-4 border border-gray-100 shadow-sm transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === key
              ? 'bg-white text-gray-900 shadow-sm font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, type = 'text', placeholder, required, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
      />
    </div>
  );
}

// ─── SELECT ───────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, children, required, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      >
        {children}
      </select>
    </div>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────────────
export function Btn({ onClick, children, variant = 'primary', size = 'md', disabled = false, className = '' }) {
  const base = 'font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-sm' };
  const variants = {
    primary:   'bg-[#e85d26] text-white hover:bg-[#c44c1e]',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger:    'bg-red-100 text-red-700 hover:bg-red-200',
    ghost:     'bg-transparent text-gray-600 hover:bg-gray-100',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export function EmptyState({ emoji = '📭', title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="font-medium text-gray-700">{title}</p>
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── LOT STATUS BADGE ─────────────────────────────────────────────────────────
import { LOT_STATUS, LOT_PRIORITY } from '../constants';

export function LotStatusBadge({ status }) {
  const meta = LOT_STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <Badge cls={meta.cls}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const meta = LOT_PRIORITY[priority] || { label: priority, cls: 'bg-gray-100 text-gray-600' };
  return <Badge cls={meta.cls}>{meta.label}</Badge>;
}

// ─── LOT PROGRESS STEPS ───────────────────────────────────────────────────────
import { LOT_STATUS_STEPS, ACCENT } from '../constants';

export function LotSteps({ status }) {
  const curStep = LOT_STATUS[status]?.step || 0;
  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {LOT_STATUS_STEPS.map(([key, label], i) => {
        const step = LOT_STATUS[key].step;
        const done   = step < curStep;
        const active = step === curStep;
        return (
          <>
            <div key={key} className="flex flex-col items-center min-w-[64px]">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: done ? '#10b981' : active ? ACCENT : '#e5e7eb', color: done || active ? '#fff' : '#9ca3af' }}
              >
                {done ? '✓' : step}
              </div>
              <p className="text-[8px] text-center mt-1 leading-tight"
                 style={{ color: active ? ACCENT : done ? '#10b981' : '#9ca3af', fontWeight: active ? 700 : 400 }}>
                {label}
              </p>
            </div>
            {i < LOT_STATUS_STEPS.length - 1 && (
              <div className="h-[2px] flex-1 min-w-[10px] -mt-3"
                   style={{ background: done ? '#10b981' : '#e5e7eb' }} />
            )}
          </>
        );
      })}
    </div>
  );
}

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────
export function PageHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-base font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
