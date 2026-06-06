import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`
        relative bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl
        w-full ${wide ? 'max-w-4xl' : 'max-w-lg'}
        max-h-[90vh] flex flex-col animate-scale-in
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-800 text-navy-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
