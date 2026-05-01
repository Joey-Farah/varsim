import { useState, useCallback } from 'react'
import clips from './data/clips.json'
import VideoPlayer from './components/VideoPlayer'
import DecisionPanel from './components/DecisionPanel'
import RevealScreen from './components/RevealScreen'
import ScoreTracker from './components/ScoreTracker'

function pickRandom(arr, exclude) {
  const pool = arr.filter((c) => c.id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function App() {
  const [clip, setClip] = useState(() => clips[Math.floor(Math.random() * clips.length)])
  const [phase, setPhase] = useState('watching') // 'watching' | 'deciding' | 'reveal'
  const [userDecision, setUserDecision] = useState(null)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)
  const [streak, setStreak] = useState(0)

  const handleClipEnd = useCallback(() => {
    setPhase('deciding')
  }, [])

  const handleDecide = useCallback((decision) => {
    const correct = decision === clip.decision
    setUserDecision(decision)
    setTotal((t) => t + 1)
    setScore((s) => (correct ? s + 1 : s))
    setStreak((st) => (correct ? st + 1 : 0))
    setPhase('reveal')
  }, [clip])

  const handleNext = useCallback(() => {
    setClip(pickRandom(clips, clip.id))
    setUserDecision(null)
    setPhase('watching')
  }, [clip])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-accent">VARSIM</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Be The Referee</p>
        </div>
        <ScoreTracker score={score} total={total} streak={streak} />
      </header>

      <main className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest">
            <span>{clip.competition}</span>
            {clip.teams && <><span>·</span><span>{clip.teams}</span></>}
            <span>·</span>
            <span>{clip.season}</span>
          </div>
          <p className="text-gray-300 text-sm">{clip.context}</p>
        </div>

        <VideoPlayer
          youtubeId={clip.youtubeId}
          startSeconds={clip.startSeconds}
          clipDuration={phase === 'watching' || phase === 'deciding' ? clip.clipDuration ?? 15 : undefined}
          onClipEnd={handleClipEnd}
          resumed={phase === 'reveal'}
          muted={phase !== 'reveal'}
        />

        {phase === 'watching' && (
          <div className="text-center text-sm text-gray-500 uppercase tracking-widest animate-pulse">
            Watch the incident...
          </div>
        )}

        {phase === 'deciding' && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-gray-400 uppercase tracking-widest font-semibold">
              What's your call?
            </p>
            <DecisionPanel onDecide={handleDecide} disabled={false} allowedDecisions={clip.decisions} />
          </div>
        )}

        {phase === 'reveal' && (
          <RevealScreen clip={clip} userDecision={userDecision} onNext={handleNext} />
        )}
      </main>
    </div>
  )
}
