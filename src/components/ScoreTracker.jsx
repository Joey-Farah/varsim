export default function ScoreTracker({ score, total, streak }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100)

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex flex-col items-center">
        <span className="text-2xl font-black text-accent">{score}/{total}</span>
        <span className="text-gray-400 text-xs uppercase tracking-widest">Correct</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-black text-white">{pct}%</span>
        <span className="text-gray-400 text-xs uppercase tracking-widest">Accuracy</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-black text-orange-400">{streak}</span>
        <span className="text-gray-400 text-xs uppercase tracking-widest">Streak</span>
      </div>
    </div>
  )
}
