<template>
  <div
    ref="timelineRef"
    class="time-range-timeline"
    @wheel.prevent="handleWheel"
    @pointerdown="handlePointerDown"
  >
    <div class="timeline-header">
      <div class="header-left">
        <button
          v-if="canGoBack"
          class="header-btn"
          type="button"
          @click="goBack"
        >
          返回
        </button>
        <span class="header-title">{{ levelTitle }}</span>
        <span v-if="headerRangeLabel" class="header-range">{{ headerRangeLabel }}</span>
      </div>
      <button
        v-if="showExpand"
        class="header-btn"
        type="button"
        @click="expandSelected"
      >
        展开
      </button>
    </div>
    <div class="ruler">
      <span
        v-for="tick in minorTicks"
        :key="`minor-${tick.time}`"
        class="tick"
        :style="{ left: `${tick.left}%` }"
      />
      <span
        v-for="tick in majorTicks"
        :key="`major-${tick.time}`"
        class="tick major"
        :style="{ left: `${tick.left}%` }"
      />
      <span
        v-for="tick in majorTicks"
        :key="`label-${tick.time}`"
        class="tick-label"
        :style="{ left: `${tick.left}%` }"
      >
        {{ tick.label }}
      </span>
    </div>
    <div class="track">
      <template v-if="currentLevel !== 'hour'">
        <div
          v-for="bucket in bucketData"
          :key="bucket.key"
          class="bucket"
          :style="{ left: `${bucket.left}%`, width: `${bucket.width}%` }"
          @mouseenter="(event) => showBucketTooltip(bucket, event)"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
          @click="handleBucketClick(bucket, $event)"
        >
          <span class="bucket-fill calibrated" :style="{ width: `${bucket.calibratedPercent}%` }" />
          <span class="bucket-fill uncalibrated" :style="{ width: `${bucket.uncalibratedPercent}%` }" />
        </div>
      </template>
      <template v-else>
        <div
          v-for="segment in visibleSegments"
          :key="`${segment.start}-${segment.end}-${segment.status}`"
          class="segment"
          :class="segment.status"
          :style="{ left: `${segment.left}%`, width: `${segment.width}%` }"
          @mouseenter="(event) => showSegmentTooltip(segment, event)"
          @mousemove="moveTooltip"
          @mouseleave="hideTooltip"
          @click="handleSegmentClick(segment, $event)"
        />
      </template>
    </div>
    <div v-if="isEmpty" class="timeline-empty">暂无扫描记录</div>
    <span
      v-if="nowLineVisible"
      class="now-line"
      :style="{ left: `${nowLineLeft}%` }"
    />
  </div>
  <div
    v-if="tooltip.visible"
    class="timeline-tooltip"
    :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
  >
    <div class="tooltip-title">{{ tooltip.title }}</div>
    <div v-for="line in tooltip.lines" :key="line" class="tooltip-line">
      {{ line }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

type SegmentStatus = 'calibrated' | 'uncalibrated'

type Level = 'overview' | 'day' | 'hour'

type OverviewUnit = 'month'

interface TimeRange {
  start: number
  end: number
}

interface Segment {
  start: number
  end: number
  status: SegmentStatus
}

interface Tick {
  time: number
  left: number
  label: string
}

interface MinorTick {
  time: number
  left: number
}

interface Bucket {
  key: string
  start: number
  end: number
  label: string
  left: number
  width: number
  calibratedPercent: number
  uncalibratedPercent: number
}

interface RangeLevel {
  level: Level
  boundsStart: number
  boundsEnd: number
  visibleStart: number
  visibleEnd: number
}

const props = defineProps<{
  overallRange: TimeRange
  segments: Segment[]
  now: number
}>()

const emit = defineEmits<{
  'visible-change': [TimeRange]
  'segment-click': [Segment]
}>()

const currentLevel = ref<Level>('overview')
const levelBoundsStart = ref(props.overallRange.start)
const levelBoundsEnd = ref(props.overallRange.end)
const visibleStart = ref(props.overallRange.start)
const visibleEnd = ref(props.overallRange.end)
const levelStack = ref<RangeLevel[]>([])
const timelineRef = ref<HTMLElement | null>(null)
const panMoveHandler = ref<((event: PointerEvent) => void) | null>(null)
const panUpHandler = ref<(() => void) | null>(null)

const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as string[],
})

const dayMs = 24 * 60 * 60 * 1000
const hourMs = 60 * 60 * 1000
const minuteMs = 60 * 1000

const activeRange = computed(() => ({
  start: visibleStart.value,
  end: visibleEnd.value,
}))

const overviewUnit = computed<OverviewUnit>(() => 'month')

const levelTitle = computed(() => {
  if (currentLevel.value === 'overview') return '概览'
  if (currentLevel.value === 'day') return '日'
  return '小时'
})

const headerRangeLabel = computed(() => {
  if (currentLevel.value === 'overview') return ''
  return formatHeaderRange(activeRange.value.start, activeRange.value.end)
})

const canGoBack = computed(() => levelStack.value.length > 0)

const showExpand = computed(() => currentLevel.value !== 'hour' && bucketData.value.length > 0)

const nowLineVisible = computed(
  () =>
    props.now >= activeRange.value.start &&
    props.now <= activeRange.value.end &&
    props.now >= props.overallRange.start &&
    props.now <= props.overallRange.end,
)

const nowLineLeft = computed(() =>
  toPercent(props.now, activeRange.value.start, activeRange.value.end),
)

const isEmpty = computed(() => props.segments.length === 0)

const bucketData = computed<Bucket[]>(() => {
  if (currentLevel.value === 'hour') return []
  const unit = currentLevel.value === 'overview' ? overviewUnit.value : 'day'
  const buckets = buildBuckets(activeRange.value.start, activeRange.value.end, unit)
  return buckets.map((bucket) => {
    const totals = sumBucket(bucket.start, bucket.end)
    const totalDuration = bucket.end - bucket.start
    const calibratedPercent = totalDuration > 0 ? (totals.calibrated / totalDuration) * 100 : 0
    const clampedCalibrated = Math.max(0, Math.min(100, calibratedPercent))
    return {
      key: `${bucket.start}-${bucket.end}`,
      start: bucket.start,
      end: bucket.end,
      label: bucket.label,
      left: toPercent(bucket.start, activeRange.value.start, activeRange.value.end),
      width: Math.max(
        0.5,
        toPercent(bucket.end, activeRange.value.start, activeRange.value.end) -
          toPercent(bucket.start, activeRange.value.start, activeRange.value.end),
      ),
      calibratedPercent: clampedCalibrated,
      uncalibratedPercent: Math.max(0, 100 - clampedCalibrated),
    }
  })
})

const majorTicks = computed(() => {
  if (currentLevel.value !== 'hour') {
    return bucketData.value.map((bucket) => ({
      time: bucket.start,
      left: bucket.left,
      label: bucket.label,
    }))
  }

  const rangeStartValue = activeRange.value.start
  const rangeEndValue = activeRange.value.end

  const ticks: Tick[] = []
  let cursor = startOfHour(rangeStartValue)
  if (cursor < rangeStartValue) cursor += hourMs
  while (cursor <= rangeEndValue) {
    ticks.push({
      time: cursor,
      left: toPercent(cursor, rangeStartValue, rangeEndValue),
      label: formatHour(cursor),
    })
    cursor += hourMs
  }
  return ticks
})

const minorTicks = computed(() => {
  if (currentLevel.value !== 'hour') {
    return []
  }

  const rangeStartValue = activeRange.value.start
  const rangeEndValue = activeRange.value.end
  const ticks: MinorTick[] = []
  const step = minuteMs * 15

  let cursor = alignToStep(rangeStartValue, step)
  if (cursor < rangeStartValue) cursor += step

  while (cursor <= rangeEndValue) {
    const isMajor = new Date(cursor).getMinutes() === 0
    if (!isMajor) {
      ticks.push({
        time: cursor,
        left: toPercent(cursor, rangeStartValue, rangeEndValue),
      })
    }
    cursor += step
  }

  return ticks
})

const visibleSegments = computed(() => {
  if (currentLevel.value !== 'hour') return []
  const rangeStartValue = activeRange.value.start
  const rangeEndValue = activeRange.value.end
  return props.segments
    .filter((segment) => segment.end > rangeStartValue && segment.start < rangeEndValue)
    .map((segment) => {
      const clampedStart = Math.max(segment.start, rangeStartValue)
      const clampedEnd = Math.min(segment.end, rangeEndValue)
      return {
        ...segment,
        left: toPercent(clampedStart, rangeStartValue, rangeEndValue),
        width: Math.max(
          0.5,
          toPercent(clampedEnd, rangeStartValue, rangeEndValue) -
            toPercent(clampedStart, rangeStartValue, rangeEndValue),
        ),
      }
    })
})

const minSpanMs = computed(() => {
  if (currentLevel.value === 'overview') return dayMs * 7
  if (currentLevel.value === 'day') return hourMs * 6
  return minuteMs * 30
})

const applyVisibleRange = (start: number, end: number) => {
  const boundsStart = levelBoundsStart.value
  const boundsEnd = levelBoundsEnd.value
  const maxSpan = Math.max(boundsEnd - boundsStart, minSpanMs.value)
  const span = Math.min(Math.max(end - start, minSpanMs.value), maxSpan)
  let nextStart = start
  let nextEnd = start + span

  if (nextStart < boundsStart) {
    nextStart = boundsStart
    nextEnd = boundsStart + span
  }
  if (nextEnd > boundsEnd) {
    nextEnd = boundsEnd
    nextStart = boundsEnd - span
  }

  visibleStart.value = nextStart
  visibleEnd.value = nextEnd
  emit('visible-change', { start: nextStart, end: nextEnd })
}

const handleWheel = (event: WheelEvent) => {
  const rect = timelineRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoomFactor = event.deltaY > 0 ? 1.12 : 0.88
  const currentSpan = activeRange.value.end - activeRange.value.start
  const targetSpan = currentSpan * zoomFactor
  const ratio = (event.clientX - rect.left) / rect.width
  const anchor = activeRange.value.start + currentSpan * ratio
  const nextStart = anchor - targetSpan * ratio
  const nextEnd = nextStart + targetSpan
  applyVisibleRange(nextStart, nextEnd)
}

const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  if ((event.target as HTMLElement)?.closest('.segment, .bucket, .header-btn')) return
  const rect = timelineRef.value?.getBoundingClientRect()
  if (!rect) return

  const startX = event.clientX
  const startVisibleStart = activeRange.value.start
  const span = activeRange.value.end - activeRange.value.start

  const handleMove = (moveEvent: PointerEvent) => {
    const deltaX = moveEvent.clientX - startX
    const deltaTime = -(deltaX / rect.width) * span
    applyVisibleRange(startVisibleStart + deltaTime, startVisibleStart + deltaTime + span)
  }

  const handleUp = () => {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    panMoveHandler.value = null
    panUpHandler.value = null
  }

  panMoveHandler.value = handleMove
  panUpHandler.value = handleUp
  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
}

const drillTo = (range: TimeRange, nextLevel: Level) => {
  levelStack.value.push({
    level: currentLevel.value,
    boundsStart: levelBoundsStart.value,
    boundsEnd: levelBoundsEnd.value,
    visibleStart: visibleStart.value,
    visibleEnd: visibleEnd.value,
  })
  currentLevel.value = nextLevel
  levelBoundsStart.value = range.start
  levelBoundsEnd.value = range.end
  visibleStart.value = range.start
  visibleEnd.value = range.end
  emit('visible-change', { start: range.start, end: range.end })
}

const goBack = () => {
  const previous = levelStack.value.pop()
  if (!previous) return
  currentLevel.value = previous.level
  levelBoundsStart.value = previous.boundsStart
  levelBoundsEnd.value = previous.boundsEnd
  visibleStart.value = previous.visibleStart
  visibleEnd.value = previous.visibleEnd
  emit('visible-change', { start: previous.visibleStart, end: previous.visibleEnd })
}

const handleBucketClick = (bucket: Bucket, event: MouseEvent) => {
  showBucketTooltip(bucket, event)
  if (currentLevel.value === 'overview') {
    drillTo({ start: bucket.start, end: bucket.end }, 'day')
  } else if (currentLevel.value === 'day') {
    drillTo({ start: bucket.start, end: bucket.end }, 'hour')
  }
}

const expandSelected = () => {
  const fallback = bucketData.value.find((bucket) =>
    props.now >= bucket.start && props.now <= bucket.end,
  ) || bucketData.value[0]
  const bucket = fallback
  if (!bucket) return
  if (currentLevel.value === 'overview') {
    drillTo({ start: bucket.start, end: bucket.end }, 'day')
  } else if (currentLevel.value === 'day') {
    drillTo({ start: bucket.start, end: bucket.end }, 'hour')
  }
}

const showSegmentTooltip = (segment: Segment, event: MouseEvent) => {
  tooltip.visible = true
  tooltip.x = event.clientX + 12
  tooltip.y = event.clientY - 12
  tooltip.title =
    segment.status === 'calibrated'
      ? '已校准 / Calibrated'
      : '未被校准 / Uncalibrated'
  tooltip.lines = [
    `${formatTooltipTime(segment.start)} - ${formatTooltipTime(segment.end)}`,
  ]
}

const showBucketTooltip = (bucket: Bucket, event: MouseEvent) => {
  tooltip.visible = true
  tooltip.x = event.clientX + 12
  tooltip.y = event.clientY - 12
  tooltip.title = `${bucket.label} 汇总`
  tooltip.lines = [
    `已校准 ${bucket.calibratedPercent.toFixed(0)}%`,
    `未被校准 ${bucket.uncalibratedPercent.toFixed(0)}%`,
    `${formatTooltipTime(bucket.start)} - ${formatTooltipTime(bucket.end)}`,
  ]
}

const moveTooltip = (event: MouseEvent) => {
  if (!tooltip.visible) return
  tooltip.x = event.clientX + 12
  tooltip.y = event.clientY - 12
}

const hideTooltip = () => {
  tooltip.visible = false
}

const handleSegmentClick = (segment: Segment, event: MouseEvent) => {
  showSegmentTooltip(segment, event)
  emit('segment-click', segment)
}

const buildBuckets = (start: number, end: number, unit: OverviewUnit | 'day') => {
  const buckets: Array<{ start: number; end: number; label: string }> = []
  let cursor = start

  while (cursor < end) {
    if (unit === 'month') {
      const monthStart = startOfMonth(cursor)
      const nextMonthStart = addMonths(monthStart, 1)
      const bucketEnd = Math.min(nextMonthStart, end)
      buckets.push({
        start: cursor,
        end: bucketEnd,
        label: formatMonth(cursor),
      })
      cursor = bucketEnd
    } else if (unit === 'day') {
      const dayStart = startOfDay(cursor)
      const nextDayStart = dayStart + dayMs
      const bucketEnd = Math.min(nextDayStart, end)
      buckets.push({
        start: cursor,
        end: bucketEnd,
        label: formatDay(cursor),
      })
      cursor = bucketEnd
    }
  }

  return buckets
}

const sumBucket = (start: number, end: number) => {
  let calibrated = 0
  let uncalibrated = 0

  props.segments.forEach((segment) => {
    if (segment.end <= start || segment.start >= end) return
    const overlapStart = Math.max(segment.start, start)
    const overlapEnd = Math.min(segment.end, end)
    const overlap = Math.max(0, overlapEnd - overlapStart)
    if (overlap <= 0) return
    if (segment.status === 'calibrated') {
      calibrated += overlap
    } else {
      uncalibrated += overlap
    }
  })

  return { calibrated, uncalibrated }
}

const toPercent = (value: number, start: number, end: number) =>
  ((value - start) / (end - start)) * 100

const alignToStep = (time: number, step: number) =>
  Math.floor(time / step) * step

const startOfMonth = (time: number) => {
  const date = new Date(time)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const addMonths = (time: number, amount: number) => {
  const date = new Date(time)
  date.setMonth(date.getMonth() + amount)
  return date.getTime()
}

const startOfDay = (time: number) => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const startOfHour = (time: number) => {
  const date = new Date(time)
  date.setMinutes(0, 0, 0)
  return date.getTime()
}

const formatMonth = (time: number) => {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

const formatDay = (time: number) => {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

const formatHour = (time: number) => {
  const date = new Date(time)
  const hour = date.getHours()
  const period = hour >= 12 ? 'PM' : 'AM'
  const normalized = hour % 12 || 12
  return `${String(normalized).padStart(2, '0')}:00 ${period}`
}

const formatHeaderRange = (start: number, end: number) => {
  const startLabel = formatTooltipTime(start)
  const endLabel = formatTooltipTime(end)
  return `${startLabel} ~ ${endLabel}`
}

const formatTooltipTime = (time: number) => {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

watch(
  () => props.overallRange,
  (range) => {
    levelBoundsStart.value = range.start
    levelBoundsEnd.value = range.end
    visibleStart.value = range.start
    visibleEnd.value = range.end
    currentLevel.value = 'overview'
    levelStack.value = []
  },
  { deep: true },
)
</script>

<style scoped>
.time-range-timeline {
  position: absolute;
  bottom: 50px;
  width: 90%;
  padding: 10px 18px 14px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(14px);
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  cursor: grab;
}

.time-range-timeline:active {
  cursor: grabbing;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 1px;
}

.header-range {
  font-size: 11px;
  color: rgba(107, 114, 128, 0.9);
}

.header-btn {
  border: none;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(55, 65, 81, 0.85);
  background: rgba(148, 163, 184, 0.18);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.header-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #1f2937;
}

.ruler {
  position: relative;
  height: 26px;
}

.tick {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 7px;
  background: rgba(148, 163, 184, 0.5);
}

.tick.major {
  height: 12px;
  background: rgba(107, 114, 128, 0.75);
}

.tick-label {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(85, 85, 85, 0.9);
  font-weight: 600;
  white-space: nowrap;
}

.track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.8);
  overflow: hidden;
}

.timeline-empty {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(107, 114, 128, 0.9);
  text-align: center;
}

.segment,
.bucket {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  cursor: pointer;
}

.segment.calibrated,
.bucket-fill.calibrated {
  background: #19a56b;
}

.segment.uncalibrated,
.bucket-fill.uncalibrated {
  background: #f2b233;
}

.bucket {
  display: flex;
  overflow: hidden;
}

.bucket-fill {
  height: 100%;
  transition: width 0.2s ease;
}

.now-line {
  position: absolute;
  top: 7px;
  bottom: 5px;
  width: 2px;
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.45);
  pointer-events: none;
}

.timeline-tooltip {
  position: fixed;
  z-index: 2000;
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  border-radius: 10px;
  padding: 8px 10px;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
  pointer-events: none;
  min-width: 170px;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
}

.tooltip-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.tooltip-line {
  font-size: 11px;
  color: rgba(71, 85, 105, 0.9);
}
</style>
