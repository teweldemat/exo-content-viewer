import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDom, renderClient, renderStatic, click } from './helpers/dom.js'
import { createStaticContentSource } from '../src/content-source.js'
import { HtmlView } from '../src/renderers/html.js'
import { ImageView } from '../src/renderers/image.js'
import { MediaView, isVideo } from '../src/renderers/media.js'
import { SvgView } from '../src/renderers/svg.js'

installDom()

const hostileSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>'

function urlSource(name: string, mediaType: string, text?: string) {
  return createStaticContentSource({
    name,
    mediaType,
    text: text ?? '',
    url: (options) => (options?.preview ? `/preview/${name}` : options?.download ? `/download/${name}` : `/raw/${name}`),
  })
}

test('image renders an img on the preview url with zoom controls and a checkerboard', () => {
  const html = renderStatic(<ImageView source={urlSource('photo.png', 'image/png')} colorMode="light" />)
  assert.match(html, /<img src="\/preview\/photo.png" alt="photo.png"/)
  assert.match(html, /cv-checkerboard/)
  assert.match(html, /aria-pressed="true">Fit</)
  assert.match(html, />100%</)
  assert.match(html, />200%</)
  const none = renderStatic(<ImageView source={createStaticContentSource({ name: 'x.png', mediaType: 'image/png', textual: false })} colorMode="light" />)
  assert.match(none, /No preview URL/)
})

test('svg is shown only through img and never inlined, with a view-source switch', async () => {
  const source = urlSource('icon.svg', 'image/svg+xml', hostileSvg)
  const html = renderStatic(<SvgView source={source} colorMode="light" />)
  assert.match(html, /<img src="\/preview\/icon.svg" alt="icon.svg"/)
  assert.doesNotMatch(html, /<svg/)
  assert.doesNotMatch(html, /<script/)
  assert.match(html, /data-view="image"/)

  const rendered = await renderClient(<SvgView source={source} colorMode="light" />)
  click(rendered.container.querySelector('input[type="checkbox"]')!)
  await rendered.waitFor(() => rendered.container.querySelector('.cv-code-view'))
  assert.ok(!rendered.container.querySelector('svg:not(.lucide)'), 'source view shows text, not markup (icons excluded)')
  assert.ok(!rendered.container.querySelector('script'))
  assert.match(rendered.container.textContent ?? '', /<script>alert\(1\)<\/script>/, 'source text is visible as text')
  await rendered.unmount()
})

test('html renders a sandboxed iframe from the preview url, never srcdoc', () => {
  const source = urlSource('page.html', 'text/html', '<script>alert(1)</script>')
  const html = renderStatic(<HtmlView source={source} colorMode="light" />)
  assert.match(html, /<iframe class="cv-html-frame" sandbox="" src="\/preview\/page.html" title="page.html" referrerpolicy="no-referrer"/i)
  assert.doesNotMatch(html, /srcdoc/)
  assert.doesNotMatch(html, /<script/)
  assert.match(html, /data-view="preview"/)
  const withoutUrl = renderStatic(<HtmlView source={createStaticContentSource({ name: 'page.html', mediaType: 'text/html', text: '<p>x</p>' })} colorMode="light" />)
  assert.doesNotMatch(withoutUrl, /<iframe/)
  assert.match(withoutUrl, /data-view="source"/)
})

test('media renders native video or audio elements on the preview url', () => {
  const video = renderStatic(<MediaView source={urlSource('clip.mp4', 'video/mp4')} colorMode="light" />)
  assert.match(video, /<video class="cv-media-video" controls="" preload="metadata" src="\/preview\/clip.mp4"/)
  const audio = renderStatic(<MediaView source={urlSource('song.mp3', 'audio/mpeg')} colorMode="light" />)
  assert.match(audio, /<audio class="cv-media-audio" controls="" preload="metadata" src="\/preview\/song.mp3"/)
  assert.equal(isVideo(createStaticContentSource({ name: 'x.webm' })), true)
  assert.equal(isVideo(createStaticContentSource({ name: 'x.wav' })), false)
})
