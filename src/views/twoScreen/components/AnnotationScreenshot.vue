<template>
  <ScreenshotAnnotator
    :visible="overlayVisible"
    :base-image="baseImage"
    :capture-rect="captureRect"
    :auto-select-full="true"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import html2canvas from 'html2canvas'
import { ElMessage } from 'element-plus'
import ScreenshotAnnotator from './ScreenshotAnnotator.vue'

const props = defineProps<{
  getTargetElement: () => HTMLElement | null
  getCaptureDataUrl?: () =>
    | Promise<{ dataUrl: string; rect?: DOMRect } | string | null>
    | { dataUrl: string; rect?: DOMRect }
    | string
    | null
  allowDomFallback?: boolean
}>()

type NormalizedRect = { x: number; y: number; width: number; height: number }
type ScreenshotConfirmPayload = { dataUrl: string; selection: NormalizedRect; overlayDataUrl?: string }

const emit = defineEmits<{
  confirm: [ScreenshotConfirmPayload]
  'overlay-change': [boolean]
  'loading-change': [boolean]
}>()

const overlayVisible = ref(false)
const baseImage = ref<string | null>(null)
const captureRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const loading = ref(false)

const setOverlayVisible = (value: boolean) => {
  overlayVisible.value = value
  emit('overlay-change', value)
}

const setLoading = (value: boolean) => {
  loading.value = value
  emit('loading-change', value)
}

const waitFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const createOklchSanitizer = (doc: Document) => {
  const canvas = doc.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const normalizeColor = (value: string) => {
    if (!ctx || !value) return value
    try {
      ctx.fillStyle = '#000'
      ctx.fillStyle = value.trim()
      return ctx.fillStyle
    } catch {
      return 'rgb(0 0 0)'
    }
  }
  const replaceOklch = (value: string, replacer: (match: string) => string) => {
    if (!value) return value
    const lower = value.toLowerCase()
    if (!lower.includes('oklch')) return value
    let result = ''
    let index = 0
    while (index < value.length) {
      const found = lower.indexOf('oklch', index)
      if (found === -1) {
        result += value.slice(index)
        break
      }
      const afterName = found + 5
      let cursor = afterName
      while (cursor < value.length && /\\s/.test(value[cursor])) cursor += 1
      if (value[cursor] !== '(') {
        result += value.slice(index, afterName)
        index = afterName
        continue
      }
      let depth = 0
      let end = cursor
      for (; end < value.length; end += 1) {
        const char = value[end]
        if (char === '(') depth += 1
        else if (char === ')') {
          depth -= 1
          if (depth === 0) {
            end += 1
            break
          }
        }
      }
      if (depth !== 0) {
        result += value.slice(index)
        break
      }
      const match = value.slice(found, end)
      result += value.slice(index, found) + replacer(match)
      index = end
    }
    return result
  }
  const sanitizeValue = (value: string) => replaceOklch(value, (match) => normalizeColor(match))
  const patchGetComputedStyle = (view: Window) => {
    const original = view.getComputedStyle.bind(view)
    view.getComputedStyle = (el: Element, pseudoElt?: string | null) => {
      const ownerView = el?.ownerDocument?.defaultView ?? view
      const base =
        ownerView === view ? original : ownerView.getComputedStyle.bind(ownerView)
      const style = base(el, pseudoElt as any)
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return (name: string) => sanitizeValue(target.getPropertyValue(name))
          }
          const value = Reflect.get(target, prop, target)
          if (typeof value === 'function') return value.bind(target)
          if (typeof value === 'string') return sanitizeValue(value)
          return value
        },
      }) as CSSStyleDeclaration
    }
    return () => {
      view.getComputedStyle = original
    }
  }
  return { normalizeColor, replaceOklch, sanitizeValue, patchGetComputedStyle }
}

const sanitizeOklchInClone = (doc: Document) => {
  const view = doc.defaultView
  if (!view) return
  const { normalizeColor, replaceOklch, sanitizeValue, patchGetComputedStyle } =
    createOklchSanitizer(doc)
  patchGetComputedStyle(view)
  const colorProps = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'caret-color',
    'text-decoration-color',
    '-webkit-text-stroke-color',
    'fill',
    'stroke',
  ]
  const elements = doc.querySelectorAll<HTMLElement>('*')
  elements.forEach((el) => {
    const inlineStyle = el.getAttribute('style')
    if (inlineStyle && inlineStyle.toLowerCase().includes('oklch')) {
      const sanitized = replaceOklch(inlineStyle, (match) => normalizeColor(match))
      el.setAttribute('style', sanitized)
    }
    const computed = view.getComputedStyle(el)
    if (!computed) return
    colorProps.forEach((prop) => {
      const value = computed.getPropertyValue(prop)
      if (value) {
        el.style.setProperty(prop, sanitizeValue(value))
      }
    })
    const bg = computed.getPropertyValue('background-color')
    if (bg) {
      el.style.setProperty('background-color', sanitizeValue(bg))
    }
    el.style.setProperty('background-image', 'none')
    el.style.setProperty('box-shadow', 'none')
    el.style.setProperty('text-shadow', 'none')
    el.style.setProperty('border-image-source', 'none')
  })
  doc.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent?.toLowerCase().includes('oklch')) {
      styleEl.textContent = replaceOklch(styleEl.textContent, (match) => normalizeColor(match))
    }
  })

  Array.from(doc.styleSheets).forEach((sheet) => {
    const owner = (sheet as CSSStyleSheet).ownerNode
    if (!(owner instanceof HTMLElement)) return
    try {
      const rules = (sheet as CSSStyleSheet).cssRules
      if (!rules) return
      const sanitizeRules = (ruleList: CSSRuleList) => {
        Array.from(ruleList).forEach((rule) => {
          if ('style' in rule) {
            const style = (rule as CSSRule & { style?: CSSStyleDeclaration }).style
            if (style) {
              Array.from(style).forEach((name) => {
                const value = style.getPropertyValue(name)
                if (!value) return
                const sanitized = sanitizeValue(value)
                if (sanitized !== value) {
                  style.setProperty(name, sanitized, style.getPropertyPriority(name))
                }
              })
            }
          }
          if ('cssRules' in rule) {
            const nestedRules = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules
            if (nestedRules) sanitizeRules(nestedRules)
          }
        })
      }
      sanitizeRules(rules)
    } catch {
      owner.parentNode?.removeChild(owner)
    }
  })
}

const pickCanvasSnapshot = (root: HTMLElement) => {
  const canvases: HTMLCanvasElement[] = []
  if (root instanceof HTMLCanvasElement) canvases.push(root)
  canvases.push(...Array.from(root.querySelectorAll('canvas')))
  const candidates = canvases.filter((canvas) => canvas.width > 0 && canvas.height > 0)
  if (!candidates.length) return null
  const best = candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  try {
    const dataUrl = best.toDataURL('image/png')
    const area = best.width * best.height
    const minLength = area > 10000 ? 1000 : 200
    if (dataUrl && dataUrl.length > minLength) {
      return { dataUrl, rect: best.getBoundingClientRect() }
    }
  } catch {
    return null
  }
  return null
}

const startCapture = async () => {
  if (loading.value) return
  const target = props.getTargetElement?.()
  if (!target) return
  setLoading(true)
  await waitFrame()
  const restoreComputedStyle = createOklchSanitizer(document).patchGetComputedStyle(window)
  try {
    const rect = target.getBoundingClientRect()
    const forced = await props.getCaptureDataUrl?.()
    if (forced) {
      const dataUrl = typeof forced === 'string' ? forced : forced.dataUrl
      const forcedRect = typeof forced === 'string' ? rect : forced.rect ?? rect
      if (dataUrl) {
        baseImage.value = dataUrl
        captureRect.value = {
          x: forcedRect.left,
          y: forcedRect.top,
          width: forcedRect.width,
          height: forcedRect.height,
        }
        setOverlayVisible(true)
        return
      }
    }
    if (props.allowDomFallback === false) {
      throw new Error('当前模式截图数据未就绪')
    }
    const canvasSnapshot = pickCanvasSnapshot(target)
    if (canvasSnapshot) {
      baseImage.value = canvasSnapshot.dataUrl
      captureRect.value = {
        x: canvasSnapshot.rect.left,
        y: canvasSnapshot.rect.top,
        width: canvasSnapshot.rect.width,
        height: canvasSnapshot.rect.height,
      }
      setOverlayVisible(true)
      return
    }
    const baseOptions = {
      backgroundColor: null,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      ignoreElements: (el) => {
        const element = el as HTMLElement
        return (
          element?.classList?.contains('annotation-form-panel') ||
          element?.classList?.contains('annotation-guide-mask') ||
          element?.classList?.contains('screenshot-overlay')
        )
      },
      onclone: (doc) => {
        sanitizeOklchInClone(doc)
      },
    }
    let canvas: HTMLCanvasElement
    try {
      canvas = await html2canvas(target, baseOptions)
    } catch (error) {
      const message = String((error as Error)?.message ?? error)
      if (!message.toLowerCase().includes('oklch')) throw error
      canvas = await html2canvas(target, { ...baseOptions, foreignObjectRendering: true })
    }
    baseImage.value = canvas.toDataURL('image/png')
    captureRect.value = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
    setOverlayVisible(true)
  } catch (error) {
    ElMessage.error('截图初始化失败，请重试')
  } finally {
    restoreComputedStyle()
    setLoading(false)
  }
}

const handleConfirm = (payload: ScreenshotConfirmPayload) => {
  emit('confirm', payload)
  setOverlayVisible(false)
}

const handleCancel = () => {
  setOverlayVisible(false)
}

defineExpose({
  startCapture,
})
</script>
