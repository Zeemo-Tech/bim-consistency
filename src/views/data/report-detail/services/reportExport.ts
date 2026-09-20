export interface ReportPdfExportOptions {
  filename: string
  pageSelector?: string
  reportGeneratedDate?: string
  watermarkText?: string
}

const EXPORT_IMAGE_WAIT_TIMEOUT = 3000
const EXPORT_PRINT_TIMEOUT = 30000
const EXPORT_LOG_PREFIX = '[ReportExport]'

const waitFrame = (view: Window = window) =>
  new Promise<void>((resolve) => {
    view.requestAnimationFrame(() => resolve())
  })

const withTimeout = async <T>(
  task: Promise<T>,
  timeoutMs: number,
  fallbackMessage: string,
) => {
  let timer: number | null = null
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(fallbackMessage))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) window.clearTimeout(timer)
  }
}

const normalizeExportFilename = (value: string) => {
  const text = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
  if (!text) return '巡检报告.pdf'
  return text.toLowerCase().endsWith('.pdf') ? text : `${text}.pdf`
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const waitForPageImages = async (root: ParentNode) => {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.loading = 'eager'
          img.decoding = 'sync'
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          window.setTimeout(done, EXPORT_IMAGE_WAIT_TIMEOUT)
        }),
    ),
  )
}

const copyDocumentStyles = () =>
  Array.from(
    document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style, link[rel="stylesheet"]',
    ),
  )
    .map((node) => node.outerHTML)
    .join('\n')

const applyInlineStyles = (
  element: HTMLElement,
  styles: Record<string, string | undefined>,
) => {
  Object.entries(styles).forEach(([name, value]) => {
    if (!value) return
    element.style.setProperty(name, value)
  })
}

const preparePrintableLayoutInClone = (doc: Document) => {
  doc.querySelectorAll('.preview-toolbar, .el-loading-mask').forEach((node) => {
    node.remove()
  })

  const root = doc.querySelector<HTMLElement>('.report-preview-page')
  const previewCanvas = doc.querySelector<HTMLElement>('.preview-canvas')
  const stack = doc.querySelector<HTMLElement>('.a4-stack')

  applyInlineStyles(doc.body as HTMLBodyElement, {
    margin: '0',
    background: '#ffffff',
    '-webkit-print-color-adjust': 'exact',
    'print-color-adjust': 'exact',
  })

  if (root) {
    applyInlineStyles(root, {
      background: '#ffffff',
      'min-height': 'auto',
    })
  }

  if (previewCanvas) {
    applyInlineStyles(previewCanvas, {
      padding: '0',
      overflow: 'visible',
    })
  }

  if (stack) {
    applyInlineStyles(stack, {
      gap: '0',
      'align-items': 'stretch',
    })
  }

  doc.querySelectorAll<HTMLElement>('.a4-page-shell').forEach((pageShell) => {
    applyInlineStyles(pageShell, {
      width: 'auto',
      height: 'auto',
    })
  })

  const pageElements = Array.from(doc.querySelectorAll<HTMLElement>('.a4-page'))
  const lastPage = pageElements.at(-1)

  pageElements.forEach((page) => {
    applyInlineStyles(page, {
      margin: '0',
      'box-shadow': 'none',
      'border-radius': '0',
      transform: 'none',
      'page-break-after': page === lastPage ? 'auto' : 'always',
      'break-after': page === lastPage ? 'auto' : 'page',
    })
  })
}

const syncFormControlValues = (
  sourceRoot: ParentNode,
  targetRoot: ParentNode,
) => {
  const sourceInputs = Array.from(
    sourceRoot.querySelectorAll<HTMLInputElement>('input'),
  )
  const targetInputs = Array.from(
    targetRoot.querySelectorAll<HTMLInputElement>('input'),
  )

  sourceInputs.forEach((sourceInput, index) => {
    const targetInput = targetInputs[index]
    if (!targetInput) return
    targetInput.value = sourceInput.value
    targetInput.defaultValue = sourceInput.value
    targetInput.setAttribute('value', sourceInput.value)
    targetInput.checked = sourceInput.checked
    if (sourceInput.checked) {
      targetInput.setAttribute('checked', 'checked')
    } else {
      targetInput.removeAttribute('checked')
    }
  })

  const sourceTextareas = Array.from(
    sourceRoot.querySelectorAll<HTMLTextAreaElement>('textarea'),
  )
  const targetTextareas = Array.from(
    targetRoot.querySelectorAll<HTMLTextAreaElement>('textarea'),
  )

  sourceTextareas.forEach((sourceTextarea, index) => {
    const targetTextarea = targetTextareas[index]
    if (!targetTextarea) return
    targetTextarea.value = sourceTextarea.value
    targetTextarea.defaultValue = sourceTextarea.value
    targetTextarea.textContent = sourceTextarea.value
  })

  const sourceSelects = Array.from(
    sourceRoot.querySelectorAll<HTMLSelectElement>('select'),
  )
  const targetSelects = Array.from(
    targetRoot.querySelectorAll<HTMLSelectElement>('select'),
  )

  sourceSelects.forEach((sourceSelect, index) => {
    const targetSelect = targetSelects[index]
    if (!targetSelect) return
    targetSelect.value = sourceSelect.value
    Array.from(targetSelect.options).forEach((option) => {
      option.selected = option.value === sourceSelect.value
      if (option.selected) {
        option.setAttribute('selected', 'selected')
      } else {
        option.removeAttribute('selected')
      }
    })
  })
}

const waitForFonts = async (doc: Document) => {
  const fontFaceSet = (doc as Document & { fonts?: FontFaceSet }).fonts
  if (!fontFaceSet?.ready) return
  await withTimeout(
    fontFaceSet.ready.then(() => undefined),
    5000,
    '字体加载超时',
  ).catch(() => undefined)
}

const createPrintFrame = () => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute(
    'style',
    [
      'position: fixed',
      'right: 0',
      'bottom: 0',
      'width: 0',
      'height: 0',
      'border: 0',
      'opacity: 0',
      'pointer-events: none',
    ].join(';'),
  )
  document.body.appendChild(iframe)
  return iframe
}

const writePrintDocumentShell = (doc: Document, filename: string) => {
  const title = escapeHtml(filename.replace(/\.pdf$/i, ''))
  const styles = copyDocumentStyles()
  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${styles}
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        background: #ffffff;
      }
    </style>
  </head>
  <body></body>
</html>`)
  doc.close()
}

const logReportExportError = (
  stage: string,
  error: unknown,
  context?: Record<string, unknown>,
) => {
  console.error(`${EXPORT_LOG_PREFIX} ${stage}`, {
    error,
    context: context || {},
    time: new Date().toISOString(),
  })
}

export const exportReportToPdf = async (options: ReportPdfExportOptions) => {
  const pageSelector = options.pageSelector || '.a4-stack .a4-page'
  await waitFrame()
  await waitFrame()

  const pages = Array.from(document.querySelectorAll<HTMLElement>(pageSelector))
  if (!pages.length) {
    const error = new Error('未找到可导出的报告页面')
    logReportExportError('resolve-pages', error, { pageSelector })
    throw error
  }

  const reportRoot =
    (pages[0].closest('.report-preview-page') as HTMLElement | null) ||
    (pages[0].closest('.preview-canvas') as HTMLElement | null)

  if (!reportRoot) {
    const error = new Error('未找到报告导出容器')
    logReportExportError('resolve-root', error, { pageSelector })
    throw error
  }

  try {
    await waitForPageImages(reportRoot)

    const iframe = createPrintFrame()
    const frameWindow = iframe.contentWindow
    const frameDoc = iframe.contentDocument

    if (!frameWindow || !frameDoc) {
      iframe.remove()
      throw new Error('打印容器初始化失败')
    }

    writePrintDocumentShell(frameDoc, normalizeExportFilename(options.filename))

    const clonedRoot = frameDoc.importNode(reportRoot, true) as HTMLElement
    frameDoc.body.appendChild(clonedRoot)
    syncFormControlValues(reportRoot, clonedRoot)

    preparePrintableLayoutInClone(frameDoc)
    await waitForPageImages(clonedRoot)
    await waitForFonts(frameDoc)
    await waitFrame(frameWindow)
    await waitFrame(frameWindow)

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        let settled = false
        const cleanup = () => {
          window.setTimeout(() => iframe.remove(), 300)
        }
        const finish = () => {
          if (settled) return
          settled = true
          cleanup()
          resolve()
        }

        frameWindow.addEventListener('afterprint', finish, { once: true })

        try {
          frameWindow.focus()
          frameWindow.print()
          window.setTimeout(finish, 1500)
        } catch (error) {
          cleanup()
          reject(error)
        }
      }),
      EXPORT_PRINT_TIMEOUT,
      '打印窗口打开超时',
    )
  } catch (error) {
    logReportExportError('export-print', error, {
      pageSelector,
      pageCount: pages.length,
      filename: options.filename,
    })
    throw error
  }
}
