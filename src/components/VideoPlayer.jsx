import { useEffect, useRef, useState } from 'react'

const ytCallbacks = []
let ytState = 'idle'

function whenYTReady(cb) {
  if (ytState === 'ready') { cb(); return }
  ytCallbacks.push(cb)
  if (ytState === 'idle') {
    ytState = 'loading'
    window.onYouTubeIframeAPIReady = () => {
      ytState = 'ready'
      ytCallbacks.splice(0).forEach(f => f())
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }
}

export default function VideoPlayer({ youtubeId, startSeconds = 0, clipDuration, onClipEnd, resumed, muted }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const endFiredRef = useRef(false)
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    let alive = true
    endFiredRef.current = false
    setProgress(1)

    whenYTReady(() => {
      if (!alive || !mountRef.current) return
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId: youtubeId,
        playerVars: {
          start: startSeconds,
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady({ target }) {
            target.mute()
            target.playVideo()
          },
          onStateChange({ data }) {
            const S = window.YT.PlayerState
            if (data === S.PLAYING && clipDuration && !endFiredRef.current) {
              clearTimeout(timerRef.current)
              clearInterval(intervalRef.current)

              const elapsed = Math.max(0, playerRef.current.getCurrentTime() - startSeconds)
              const remaining = Math.max(0, clipDuration - elapsed)

              const startedAt = Date.now()
              intervalRef.current = setInterval(() => {
                const spent = (Date.now() - startedAt) / 1000
                setProgress(Math.max(0, 1 - (elapsed + spent) / clipDuration))
              }, 50)

              timerRef.current = setTimeout(() => {
                if (!alive) return
                endFiredRef.current = true
                clearInterval(intervalRef.current)
                setProgress(0)
                playerRef.current?.pauseVideo()
                onClipEnd?.()
              }, remaining * 1000)
            }
            if (data === S.PAUSED || data === S.ENDED) {
              clearInterval(intervalRef.current)
            }
          },
        },
      })
    })

    return () => {
      alive = false
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [youtubeId])

  // Unmute when reveal starts
  useEffect(() => {
    if (!playerRef.current) return
    if (resumed) {
      playerRef.current.unMute()
      playerRef.current.playVideo()
    } else {
      playerRef.current.mute()
    }
  }, [resumed])

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Cover YouTube's title overlay at the top */}
      <div
        className="absolute top-0 left-0 right-0 h-14 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)' }}
      />

      {/* Mute indicator shown during watching/deciding phases */}
      {muted && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1 pointer-events-none">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.2-1.22.83v.08c0 .36.23.67.57.8C17.14 6.45 19 9.05 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
          </svg>
          <span className="text-xs text-gray-300">Audio hidden</span>
        </div>
      )}

      {/* Progress bar */}
      {clipDuration && !resumed && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 z-10">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%`, transition: 'width 50ms linear' }} />
        </div>
      )}
    </div>
  )
}
