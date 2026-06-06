export default function StatCard({ label, value, icon: Icon, color = 'gold', sub }) {
  const colorMap = {
    gold: 'from-gold-400/10 to-gold-600/5 border-gold-400/20 text-gold-400',
    green: 'from-green-400/10 to-green-600/5 border-green-400/20 text-green-400',
    blue: 'from-blue-400/10 to-blue-600/5 border-blue-400/20 text-blue-400',
    red: 'from-red-400/10 to-red-600/5 border-red-400/20 text-red-400',
    purple: 'from-purple-400/10 to-purple-600/5 border-purple-400/20 text-purple-400'
  };

  const iconColorMap = {
    gold: 'text-gold-400', green: 'text-green-400', blue: 'text-blue-400',
    red: 'text-red-400', purple: 'text-purple-400'
  };

  return (
    <div className={`
      p-5 rounded-xl border bg-gradient-to-br ${colorMap[color]}
      hover:scale-[1.02] transition-transform duration-200
      animate-fade-in opacity-0
    `}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-navy-400 font-medium">{label}</p>
          <p className="text-2xl font-semibold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-navy-500 mt-1">{sub}</p>}
        </div>
        {Icon && <Icon className={`w-6 h-6 ${iconColorMap[color]}`} />}
      </div>
    </div>
  );
}
