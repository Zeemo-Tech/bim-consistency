<script setup lang="ts">
/**
 * 强度显示区间条：直方图 + 色带 + 可拖拽上下限（对齐 Tunnel Section Analyzer 的实测预览底部颜色轴）。
 * 色带取色与 PointCloudViewer 的实际着色保持一致（grayscale / spectrum / viridis）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { RefreshLeft } from '@element-plus/icons-vue'

type ColorRampId = 'grayscale' | 'spectrum' | 'viridis'
interface DisplayRange {
  min: number
  max: number
}

const DEFAULT_DISPLAY_RANGE: DisplayRange = { min: 0, max: 1 }

const MIN_SPAN = 0.01
const GRADIENT_STOPS = 12
/** 竖向：左直方图 + 右色带；横向：上直方图 + 下色带 */
const SVG_VERT_W = 56
const SVG_VERT_H = 100
const SVG_HORIZ_W = 100
const SVG_HORIZ_H = 40
const TRACK_THICK = 12

const props = withDefaults(
  defineProps<{
    ramp?: ColorRampId
    range?: DisplayRange
    /** 固定域直方图计数（低→高，已归一化 0..1）；空则只画色带 */
    histogram?: ArrayLike<number>
    disabled?: boolean
    /** 竖向贴右缘；横向贴底边 */
    orientation?: 'vertical' | 'horizontal'
  }>(),
  {
    ramp: 'grayscale',
    range: () => ({ min: 0, max: 1 }),
    histogram: () => [],
    disabled: false,
    orientation: 'vertical',
  },
)

const emit = defineEmits<{
  (e: 'update:range', value: DisplayRange): void
}>()

const trackRef = ref<HTMLDivElement>()
const isHorizontal = computed(() => props.orientation === 'horizontal')

type DragMode = 'min' | 'max' | 'pan'
let dragMode: DragMode | null = null
let dragStartCoord = 0
let dragStartRange: DisplayRange = { ...DEFAULT_DISPLAY_RANGE }

const VIRIDIS_HEX = [0x440154, 0x31688e, 0x35b779, 0xfde725]

/** t∈[0,1] → [r,g,b]（0..1），与 PointCloudViewer 的取色完全一致。 */
function sampleRamp(ramp: ColorRampId, t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  if (ramp === 'grayscale') return [x, x, x]
  if (ramp === 'viridis') {
    const segment = Math.min(2, Math.floor(x * 3))
    const local = Math.min(1, Math.max(0, x * 3 - segment))
    const a = VIRIDIS_HEX[segment]
    const b = VIRIDIS_HEX[segment + 1]
    const ar = (a >> 16) & 255
    const ag = (a >> 8) & 255
    const ab = a & 255
    const br = (b >> 16) & 255
    const bg = (b >> 8) & 255
    const bb = b & 255
    return [
      (ar + (br - ar) * local) / 255,
      (ag + (bg - ag) * local) / 255,
      (ab + (bb - ab) * local) / 255,
    ]
  }
  // spectrum / 彩虹：蓝(低) → 青 → 绿 → 黄 → 红(高)
  const hue = (1 - x) * 240
  const hh = hue / 60
  const xx = 1 - Math.abs((hh % 2) - 1)
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) {
    r = 1
    g = xx
  } else if (hh < 2) {
    r = xx
    g = 1
  } else if (hh < 3) {
    g = 1
    b = xx
  } else if (hh < 4) {
    g = xx
    b = 1
  } else {
    r = xx
    b = 1
  }
  return [r, g, b]
}

const gradientCss = computed(() => {
  const stops: string[] = []
  for (let i = 0; i <= GRADIENT_STOPS; i++) {
    const t = i / GRADIENT_STOPS
    const [r, g, b] = sampleRamp(props.ramp, t)
    stops.push(
      `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}) ${(t * 100).toFixed(1)}%`,
    )
  }
  const dir = isHorizontal.value ? 'to right' : 'to top'
  return `linear-gradient(${dir}, ${stops.join(', ')})`
})

/**
 * 拖动草稿：只改本地 UI，不立刻 emit。
 * 否则每次 pointermove 都会触发全瓦片 CPU 重着色，滑杆必卡。
 */
const draftRange = ref<DisplayRange | null>(null)
const viewRange = computed(() => draftRange.value ?? props.range)

const minPct = computed(() => clamp01(viewRange.value.min) * 100)
const maxPct = computed(() => clamp01(viewRange.value.max) * 100)

const svgW = computed(() => (isHorizontal.value ? SVG_HORIZ_W : SVG_VERT_W))
const svgH = computed(() => (isHorizontal.value ? SVG_HORIZ_H : SVG_VERT_H))

function binPeak(bins: ArrayLike<number> | undefined) {
  const n = bins?.length ?? 0
  if (n < 2) return 0
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Number(bins![i]) || 0)
  return peak
}

/**
 * 竖向：峰向左，基线贴色带左缘；y=0 顶=标量1。
 * 横向：峰向上，基线贴色带上缘；x=0 左=标量0。
 */
const histogramPath = computed(() => {
  const bins = props.histogram
  const n = bins?.length ?? 0
  const peak = binPeak(bins)
  if (n < 2 || peak <= 0) return ''

  if (isHorizontal.value) {
    const baseY = SVG_HORIZ_H - TRACK_THICK
    const histH = baseY
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const amp = (Number(bins![i]) || 0) / peak
      pts.push({
        x: t * SVG_HORIZ_W,
        y: baseY - amp * (histH - 3),
      })
    }
    let d = `M 0 ${baseY}`
    d += ` L ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const cur = pts[i]
      const mx = ((prev.x + cur.x) / 2).toFixed(2)
      const my = ((prev.y + cur.y) / 2).toFixed(2)
      d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx} ${my}`
    }
    const last = pts[pts.length - 1]
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
    d += ` L ${SVG_HORIZ_W} ${baseY} Z`
    return d
  }

  const baseX = SVG_VERT_W - TRACK_THICK
  const histW = baseX
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const amp = (Number(bins![i]) || 0) / peak
    pts.push({
      x: baseX - amp * (histW - 3),
      y: (1 - t) * SVG_VERT_H,
    })
  }
  let d = `M ${baseX} ${SVG_VERT_H}`
  d += ` L ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const mx = ((prev.x + cur.x) / 2).toFixed(2)
    const my = ((prev.y + cur.y) / 2).toFixed(2)
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx} ${my}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  d += ` L ${baseX} 0 Z`
  return d
})

const histogramStroke = computed(() => {
  const bins = props.histogram
  const n = bins?.length ?? 0
  const peak = binPeak(bins)
  if (n < 2 || peak <= 0) return ''

  if (isHorizontal.value) {
    const baseY = SVG_HORIZ_H - TRACK_THICK
    const histH = baseY
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const amp = (Number(bins![i]) || 0) / peak
      pts.push({
        x: t * SVG_HORIZ_W,
        y: baseY - amp * (histH - 3),
      })
    }
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const cur = pts[i]
      const mx = ((prev.x + cur.x) / 2).toFixed(2)
      const my = ((prev.y + cur.y) / 2).toFixed(2)
      d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx} ${my}`
    }
    return d
  }

  const baseX = SVG_VERT_W - TRACK_THICK
  const histW = baseX
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const amp = (Number(bins![i]) || 0) / peak
    pts.push({
      x: baseX - amp * (histW - 3),
      y: (1 - t) * SVG_VERT_H,
    })
  }
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const mx = ((prev.x + cur.x) / 2).toFixed(2)
    const my = ((prev.y + cur.y) / 2).toFixed(2)
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx} ${my}`
  }
  return d
})

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function formatTick(v: number) {
  return (clamp01(v) + 0).toFixed(2)
}

function clampRange(min: number, max: number): DisplayRange {
  let lo = clamp01(min)
  let hi = clamp01(max)
  if (hi - lo < MIN_SPAN) {
    const mid = clamp01((lo + hi) / 2)
    lo = clamp01(mid - MIN_SPAN / 2)
    hi = clamp01(lo + MIN_SPAN)
    if (hi - lo < MIN_SPAN) lo = clamp01(hi - MIN_SPAN)
  }
  return { min: lo, max: hi }
}

function pointerToValue(event: PointerEvent): number {
  const el = trackRef.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  if (isHorizontal.value) {
    if (rect.width <= 0) return 0
    return clamp01((event.clientX - rect.left) / rect.width)
  }
  if (rect.height <= 0) return 0
  return clamp01(1 - (event.clientY - rect.top) / rect.height)
}

function setDraft(min: number, max: number) {
  draftRange.value = clampRange(min, max)
}

function commitDraft() {
  if (!draftRange.value) return
  const next = draftRange.value
  draftRange.value = null
  emit('update:range', { ...next })
}

/** 百分位收束：剔除两端各 2% 的极端值，便于看清主体分布。 */
const PERCENTILE_RANGE: DisplayRange = { min: 0.02, max: 0.98 }

function resetFullRange() {
  if (props.disabled) return
  draftRange.value = null
  emit('update:range', { ...DEFAULT_DISPLAY_RANGE })
}

function applyPercentileRange() {
  if (props.disabled) return
  draftRange.value = null
  emit('update:range', { ...PERCENTILE_RANGE })
}

function onHandlePointerDown(mode: DragMode, event: PointerEvent) {
  if (props.disabled) return
  event.preventDefault()
  event.stopPropagation()
  dragMode = mode
  dragStartCoord = isHorizontal.value ? event.clientX : event.clientY
  dragStartRange = { ...(draftRange.value ?? props.range) }
  if (!draftRange.value) draftRange.value = { ...dragStartRange }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onTrackPointerDown(event: PointerEvent) {
  if (props.disabled) return
  const current = draftRange.value ?? props.range
  const v = pointerToValue(event)
  const mid = (current.min + current.max) / 2
  if (v < current.min || (v <= mid && v < current.max)) {
    setDraft(v, current.max)
    onHandlePointerDown('min', event)
  } else {
    setDraft(current.min, v)
    onHandlePointerDown('max', event)
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragMode) return
  if (dragMode === 'pan') {
    const el = trackRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const span = dragStartRange.max - dragStartRange.min
    let delta: number
    if (isHorizontal.value) {
      if (rect.width <= 0) return
      delta = (event.clientX - dragStartCoord) / rect.width
    } else {
      if (rect.height <= 0) return
      delta = -(event.clientY - dragStartCoord) / rect.height
    }
    let lo = dragStartRange.min + delta
    let hi = dragStartRange.max + delta
    if (lo < 0) {
      lo = 0
      hi = span
    } else if (hi > 1) {
      hi = 1
      lo = 1 - span
    }
    setDraft(lo, hi)
    return
  }
  const v = pointerToValue(event)
  const current = draftRange.value ?? props.range
  if (dragMode === 'min') {
    setDraft(Math.min(v, current.max - MIN_SPAN), current.max)
  } else {
    setDraft(current.min, Math.max(v, current.min + MIN_SPAN))
  }
}

function onPointerUp() {
  const wasDragging = dragMode != null
  dragMode = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (wasDragging) commitDraft()
}

onBeforeUnmount(onPointerUp)
</script>

<template>
  <div
    class="intensity-range-bar"
    :class="{ disabled, 'is-horizontal': isHorizontal }"
    role="group"
    aria-label="强度显示区间"
  >
    <header class="bar-head">
      <button
        type="button"
        class="action"
        title="重置为全幅 0–1"
        aria-label="重置显示区间"
        :disabled="disabled"
        @click="resetFullRange"
      >
        <el-icon :size="13"><RefreshLeft /></el-icon>
      </button>
      <span v-if="!isHorizontal" class="tick">
        {{ formatTick(viewRange.max) }}
      </span>
      <span v-else class="tick">{{ formatTick(viewRange.min) }}</span>
    </header>

    <div class="bar-body">
      <svg
        class="histogram"
        :viewBox="`0 0 ${svgW} ${svgH}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path v-if="histogramPath" :d="histogramPath" class="histogram-fill" />
        <path
          v-if="histogramStroke"
          :d="histogramStroke"
          class="histogram-line"
        />
      </svg>

      <div
        ref="trackRef"
        class="track"
        :style="{ background: gradientCss }"
        @pointerdown="onTrackPointerDown"
      >
        <template v-if="isHorizontal">
          <div
            class="dim start"
            :style="{ width: `${minPct}%` }"
            aria-hidden="true"
          />
          <div
            class="dim end"
            :style="{ width: `${100 - maxPct}%` }"
            aria-hidden="true"
          />
          <div
            class="selection"
            :style="{
              left: `${minPct}%`,
              width: `${Math.max(0, maxPct - minPct)}%`,
            }"
            title="拖动平移区间"
            @pointerdown.stop="onHandlePointerDown('pan', $event)"
          />
          <button
            type="button"
            class="handle min"
            :style="{ left: `${minPct}%` }"
            :disabled="disabled"
            :aria-valuemin="0"
            :aria-valuemax="1"
            :aria-valuenow="viewRange.min"
            aria-label="区间下限"
            title="下限"
            @pointerdown.stop="onHandlePointerDown('min', $event)"
          />
          <button
            type="button"
            class="handle max"
            :style="{ left: `${maxPct}%` }"
            :disabled="disabled"
            :aria-valuemin="0"
            :aria-valuemax="1"
            :aria-valuenow="viewRange.max"
            aria-label="区间上限"
            title="上限"
            @pointerdown.stop="onHandlePointerDown('max', $event)"
          />
        </template>
        <template v-else>
          <div
            class="dim top"
            :style="{ height: `${100 - maxPct}%` }"
            aria-hidden="true"
          />
          <div
            class="dim bottom"
            :style="{ height: `${minPct}%` }"
            aria-hidden="true"
          />
          <div
            class="selection"
            :style="{
              bottom: `${minPct}%`,
              height: `${Math.max(0, maxPct - minPct)}%`,
            }"
            title="拖动平移区间"
            @pointerdown.stop="onHandlePointerDown('pan', $event)"
          />
          <button
            type="button"
            class="handle max"
            :style="{ bottom: `${maxPct}%` }"
            :disabled="disabled"
            :aria-valuemin="0"
            :aria-valuemax="1"
            :aria-valuenow="viewRange.max"
            aria-label="区间上限"
            title="上限"
            @pointerdown.stop="onHandlePointerDown('max', $event)"
          />
          <button
            type="button"
            class="handle min"
            :style="{ bottom: `${minPct}%` }"
            :disabled="disabled"
            :aria-valuemin="0"
            :aria-valuemax="1"
            :aria-valuenow="viewRange.min"
            aria-label="区间下限"
            title="下限"
            @pointerdown.stop="onHandlePointerDown('min', $event)"
          />
        </template>
      </div>
    </div>

    <footer class="bar-foot">
      <button
        type="button"
        class="action"
        title="收束到 2%–98%"
        aria-label="百分位显示区间 2% 到 98%"
        :disabled="disabled"
        @click="applyPercentileRange"
      >
        %
      </button>
      <span v-if="!isHorizontal" class="tick">
        {{ formatTick(viewRange.min) }}
      </span>
      <span v-else class="tick">{{ formatTick(viewRange.max) }}</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.intensity-range-bar {
  box-sizing: border-box;
  width: 78px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 6px 6px 5px;
  border-radius: 12px;
  background: rgb(26 29 36 / 90%);
  border: 1px solid rgb(255 255 255 / 14%);
  box-shadow: 0 10px 28px rgb(0 0 0 / 28%);
  backdrop-filter: blur(6px);
  user-select: none;
  touch-action: none;

  &.disabled {
    opacity: 0.42;
    pointer-events: none;
  }

  &.is-horizontal {
    width: 100%;
    height: 52px;
    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    padding: 6px 8px;

    .bar-head,
    .bar-foot {
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      min-width: 36px;
      min-height: 0;
      padding: 0;
    }

    .bar-body {
      flex: 1 1 auto;
      min-width: 0;
    }

    .track {
      top: auto;
      right: 0;
      left: 0;
      bottom: 0;
      width: auto;
      height: 12px;
    }

    .dim {
      top: 0;
      bottom: 0;
      width: auto;
      height: auto;

      &.start {
        left: 0;
        right: auto;
        border-radius: 7px 0 0 7px;
      }

      &.end {
        left: auto;
        right: 0;
        border-radius: 0 7px 7px 0;
      }
    }

    .selection {
      top: -2px;
      bottom: -2px;
      left: 0;
      right: auto;
      width: auto;
      height: auto;
    }

    .handle {
      top: 50%;
      left: 0;
      bottom: auto;
      width: 8px;
      height: 18px;
      transform: translate(-50%, -50%);
      cursor: ew-resize;
    }
  }
}

.bar-head,
.bar-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 18px;
  padding-left: 2px;
}

.tick {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgb(226 232 240 / 82%);
  line-height: 1;
}

.action {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: rgb(255 255 255 / 10%);
  color: rgb(226 232 240 / 78%);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: #9ec1ff;
    background: rgb(255 255 255 / 16%);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.bar-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.histogram {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.histogram-fill {
  fill: rgb(186 214 255 / 42%);
  stroke: none;
}

.histogram-line {
  fill: none;
  stroke: #e8f1ff;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.track {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 12px;
  border-radius: 6px;
  overflow: visible;
  cursor: pointer;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 18%),
    0 1px 2px rgb(0 0 0 / 30%);
}

.dim {
  position: absolute;
  background: rgb(8 10 14 / 55%);
  pointer-events: none;

  &.top {
    top: 0;
    left: 0;
    right: 0;
    bottom: auto;
    border-radius: 7px 7px 0 0;
  }

  &.bottom {
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    border-radius: 0 0 7px 7px;
  }
}

.selection {
  position: absolute;
  left: -2px;
  right: -2px;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 30%);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.handle {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 8px;
  margin: 0;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 95%);
  border-radius: 999px;
  background: #6d8fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 40%);
  transform: translate(-50%, 50%);
  cursor: ns-resize;
  z-index: 2;

  &:disabled {
    cursor: not-allowed;
  }
}
</style>
