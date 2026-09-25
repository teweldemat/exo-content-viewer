import { extensionOf, mediaTypeOf } from './matching.js'
import type { ContentRenderProps } from './types.js'

export const videoExtensions = ['mp4', 'webm', 'ogv', 'mov', 'm4v']
export const audioExtensions = ['mp3', 'ogg', 'oga', 'wav', 'flac', 'm4a', 'aac', 'opus', 'weba']

export function isVideo(source: ContentRenderProps['source']): boolean {
  const mediaType = mediaTypeOf(source)
  if (mediaType) return mediaType.startsWith('video/')
  const extension = extensionOf(source)
  return extension !== null && videoExtensions.includes(extension)
}

export function MediaView({ source }: ContentRenderProps) {
  const url = source.url({ preview: true })
  if (!url) return <p className="cv-notice cv-muted">No preview URL is available for {source.name}.</p>
  const type = source.mediaType ?? undefined
  return (
    <div className="cv-media">
      {isVideo(source)
        ? <video className="cv-media-video" controls preload="metadata" src={url} title={source.name}>{type ? <source src={url} type={type} /> : null}</video>
        : <audio className="cv-media-audio" controls preload="metadata" src={url} title={source.name} />}
    </div>
  )
}

export default function MediaRenderer(props: ContentRenderProps) {
  return <MediaView {...props} />
}
