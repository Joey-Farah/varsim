const DECISION_LABELS = {
  no_foul: 'No Foul',
  foul: 'Foul / Free Kick',
  penalty: 'Penalty Kick',
  yellow_card: 'Yellow Card',
  red_card: 'Red Card',
}

export default function RevealScreen({ clip, userDecision, onNext }) {
  const correct = userDecision === clip.decision
  const userLabel = DECISION_LABELS[userDecision]
  const refLabel = clip.decisionLabel

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className={`text-5xl font-black tracking-tight ${correct ? 'text-green-400' : 'text-red-400'}`}>
        {correct ? 'CORRECT' : 'WRONG CALL'}
      </div>

      <div className="flex gap-8 text-sm">
        <div className="flex flex-col items-center gap-1">
          <span className="text-gray-400 uppercase tracking-widest text-xs">Your Call</span>
          <span className={`font-bold text-lg ${correct ? 'text-green-400' : 'text-red-400'}`}>{userLabel}</span>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-gray-400 uppercase tracking-widest text-xs">Referee's Decision</span>
          <span className="font-bold text-lg text-accent">{refLabel}</span>
        </div>
      </div>

      {clip.varInvolved && (
        <div className="text-xs text-gray-400 uppercase tracking-widest">VAR was involved in this decision</div>
      )}

      <div className="max-w-xl bg-card border border-gray-700 rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
        {clip.explanation}
      </div>

      <button
        onClick={onNext}
        className="mt-2 px-8 py-3 bg-accent text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors"
      >
        Next Clip →
      </button>
    </div>
  )
}
