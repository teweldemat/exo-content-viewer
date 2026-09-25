import { useState, type SyntheticEvent } from 'react'
import type { ContentRenderProps } from './types.js'

export type ImageZoom = 'fit' | 1 | 2

export function ImageView({ source }: ContentRenderProps) {
  const url = source.url({ preview: true })
  const [zoom, setZoom] = useState<ImageZoom>('fit')
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  if (!url) return <p className="cv-notice cv-muted">No preview URL is available for {source.name}.</p>
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    setNatural({ width: image.naturalWidth, height: image.naturalHeight })
  }
  const style = zoom === 'fit'
    ? { maxWidth: '100%', height: 'auto' }
    : natural ? { width: natural.width * zoom, height: natural.height * zoom, maxWidth: 'none' } : { transform: `scale(${zoom})`, transformOrigin: 'top left' }
  return (
    <div className="cv-image" data-zoom={String(zoom)}>
      <div className="cv-bar">
        <div className="cv-button-group" role="group" aria-label="Zoom">
          {([['fit', 'Fit'], [1, '100%'], [2, '200%']] as const).map(([value, label]) => (
            <button key={String(value)} type="button" className="cv-button" aria-pressed={zoom === value} onClick={() => setZoom(value)}>{label}</button>
          ))}
        </div>
        {natural ? <span className="cv-muted" data-cv-natural-size>{natural.width} × {natural.height} px</span> : null}
      </div>
      <div className="cv-image-stage cv-checkerboard">
        <img src={url} alt={source.name} style={style} onLoad={onLoad} draggable={false} />
      </div>
    </div>
  )
}

export default function ImageRenderer(props: ContentRenderProps) {
  return <ImageView {...props} />
}
