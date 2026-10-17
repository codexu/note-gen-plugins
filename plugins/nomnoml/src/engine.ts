import { renderSvg } from 'nomnoml'
import { serveSvgWorker } from '../../../shared/svg'

serveSvgWorker(request => {
  if (/^\s*#import\s*:/im.test(request.source)) throw new Error('External Nomnoml imports are unavailable')
  if ((request.source.match(/\[/g)?.length ?? 0) > 400) throw new Error('Nomnoml preview supports at most 400 classifiers')
  if (/url\s*\(|(?:https?|file|data):/i.test(request.source)) throw new Error('External resources are unavailable')
  const defaults = request.theme === 'dark'
    ? '#stroke: #e5e7eb\n#fill: #1f2937;#374151\n'
    : '#stroke: #1f2937\n#fill: #f3f4f6;#ffffff\n'
  return renderSvg(`#background: transparent\n#font: sans-serif\n${defaults}${request.source}`)
})
