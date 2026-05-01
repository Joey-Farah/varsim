export default function VideoPlayer({ youtubeId, startSeconds = 0 }) {
  const src = `https://www.youtube.com/embed/${youtubeId}?start=${startSeconds}&autoplay=1&rel=0&modestbranding=1`

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full rounded-xl"
        src={src}
        title="Clip"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
