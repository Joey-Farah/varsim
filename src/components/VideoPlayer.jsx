import { useEffect, useRef, useState } from 'react'

// Singleton YT API loader — safe to call multiple times
const ytCallbacks = []
let ytState = 'idle' // 'idle' | 'loading' | 'ready'

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

export default function VideoPlayer({ youtubeId, startSeconds = 0, clipDuration, onClipEnd, resumed }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const timerRef = useRef(null)
  const endFiredRef = useRef(false)
  const [progress, setProgress] = useState(1) // 1 = full, 0 = empty
  const progressRef = useRef(null)

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
          onStateChange({ data }) {
            const YT = window.YT.PlayerState
            if (data === YT.PLAYING && clipDuration && !endFiredRef.current) {
              clearTimeout(timerRef.current)
              clearInterval(progressRef.current)

              const elapsed = Math.max(0, playerRef.current.getCurrentTime() - startSeconds)
              const remaining = Math.max(0, clipDuration - elapsed)

              // Animate progress bar
              const startTime = Date.now()
              progressRef.current = setInterval(() => {
                const spent = (Date.now() - startTime) / 1000
                setProgress(Math.max(0, 1 - (elapsed + spent) / clipDuration))
              }, 50)

              timerRef.current = setTimeout(() => {
                if (!alive) return
                endFiredRef.current = true
                clearInterval(progressRef.current)
                setProgress(0)
                playerRef.current?.pauseVideo()
                onClipEnd?.()
              }, remaining * 1000)
            }
            if (data === YT.PAUSED || data === YT.ENDED) {
              clearInterval(progressRef.current)
            }
          },
        },
      })
    })

    return () => {
      alive = false
      clearTimeout(timerRef.current)
      clearInterval(progressRef.current)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [youtubeId])

  useEffect(() => {
    if (resumed && playerRef.current) {
      playerRef.current.playVideo()
    }
  }, [resumed])

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      {clipDuration && !resumed && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
          <div
            className="h-full bg-accent transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
