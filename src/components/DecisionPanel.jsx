const DECISIONS = [
  { value: 'no_foul', label: 'No Foul', color: 'bg-gray-700 hover:bg-gray-600', icon: '✓' },
  { value: 'foul', label: 'Foul / Free Kick', color: 'bg-blue-700 hover:bg-blue-600', icon: '⚽' },
  { value: 'penalty', label: 'Penalty Kick', color: 'bg-orange-600 hover:bg-orange-500', icon: '🥅' },
  { value: 'yellow_card', label: 'Yellow Card', color: 'bg-yellow-500 hover:bg-yellow-400 text-black', icon: '🟨' },
  { value: 'red_card', label: 'Red Card', color: 'bg-red-600 hover:bg-red-500', icon: '🟥' },
]

export default function DecisionPanel({ onDecide, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {DECISIONS.map(({ value, label, color, icon }) => (
        <button
          key={value}
          disabled={disabled}
          onClick={() => onDecide(value)}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl font-semibold text-sm transition-all duration-150 ${color} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span className="text-2xl">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  )
}
