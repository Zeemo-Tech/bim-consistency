<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="overlayRef"
      class="screenshot-overlay"
      :class="{ 'text-tool-active': tool === 'text' && hasSelection }"
      tabindex="0"
      @pointerdown="onOverlayPointerDown"
      @pointermove="onOverlayPointerMove"
      @pointerup="onOverlayPointerUp"
      @pointercancel="onOverlayPointerUp"
      @dblclick="onOverlayDoubleClick"
      @keydown="onOverlayKeydown"
    >
      <div v-if="!hasSelection" class="screen-mask" />
      <img
        v-if="baseImage"
        class="screenshot-base"
        :src="baseImage"
        :style="captureStyle"
        alt=""
      />
      <canvas ref="annotationCanvasRef" class="annotation-canvas" :style="captureStyle"></canvas>

      <div v-if="hasSelection" class="selection-rect" :style="selectionStyle" />
      <div v-if="hasSelection" class="selection-handle-layer">
        <span
          v-for="handle in selectionHandles"
          :key="handle.key"
          class="selection-handle"
          :style="handle.style"
          @pointerdown.stop="onSelectionHandleDown(handle.key, $event)"
        />
      </div>

      <div v-if="selectedAnnotationHandles.length" class="annotation-handle-layer">
        <span
          v-for="handle in selectedAnnotationHandles"
          :key="handle.key"
          class="annotation-handle"
          :style="handle.style"
          @pointerdown.stop="onAnnotationHandleDown(handle.key, $event)"
        />
      </div>

      <div v-if="toolbarVisible" class="annotation-toolbar" :style="toolbarStyle">
        <div class="toolbar-group">
          <el-tooltip content="选择/移动" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'select' }"
              type="button"
              @click="setTool('select')"
            >
              <el-icon><Pointer /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip content="矩形" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'rect' }"
              type="button"
              @click="setTool('rect')"
            >
              <span class="tool-rect-icon" />
            </button>
          </el-tooltip>
          <el-tooltip content="圆形" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'circle' }"
              type="button"
              @click="setTool('circle')"
            >
              <img src="/images/circle.svg" alt="" />
            </button>
          </el-tooltip>
          <el-tooltip content="箭头" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'arrow' }"
              type="button"
              @click="setTool('arrow')"
            >
              <img src="/images/ArrowUpRight.svg" alt="" />
            </button>
          </el-tooltip>
          <el-tooltip content="画笔" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'pen' }"
              type="button"
              @click="setTool('pen')"
            >
              <el-icon><Brush /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip content="文字" placement="top">
            <button
              class="tool-btn"
              :class="{ active: tool === 'text' }"
              type="button"
              @click="setTool('text')"
            >
              <img src="/images/TextAlignCenter.svg" alt="" />
            </button>
          </el-tooltip>
          <el-tooltip content="加粗" placement="top">
            <button
              class="tool-btn"
              :class="{ active: textBold }"
              type="button"
              @click="textBold = !textBold"
            >
              <img src="/images/TextB.svg" alt="" />
            </button>
          </el-tooltip>
          <el-tooltip content="减小文字" placement="top">
            <button
              class="tool-btn text-size-btn"
              type="button"
              :disabled="textFontSize <= minTextFontSize"
              @click="adjustTextFontSize(-2)"
            >
              <span>A-</span>
            </button>
          </el-tooltip>
          <span class="text-size-indicator">{{ textFontSize }}</span>
          <el-tooltip content="增大文字" placement="top">
            <button
              class="tool-btn text-size-btn"
              type="button"
              :disabled="textFontSize >= maxTextFontSize"
              @click="adjustTextFontSize(2)"
            >
              <span>A+</span>
            </button>
          </el-tooltip>
        </div>

        <div class="toolbar-group colors">
          <el-tooltip v-for="c in colors" :key="c" :content="c" placement="top">
            <button
              class="color-dot"
              type="button"
              :style="{ background: c }"
              :class="{ active: color === c, light: c === '#ffffff' }"
              @click="color = c"
            />
          </el-tooltip>
        </div>

        <div class="toolbar-group">
          <el-tooltip content="撤销" placement="top">
            <button class="tool-btn" type="button" :disabled="!canUndo" @click="handleUndo">
              <el-icon><RefreshLeft /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip content="重做" placement="top">
            <button class="tool-btn" type="button" :disabled="!canRedo" @click="handleRedo">
              <el-icon><RefreshRight /></el-icon>
            </button>
          </el-tooltip>
        </div>

        <div class="toolbar-group">
          <el-tooltip content="确认" placement="top">
            <button class="tool-btn primary" type="button" @click="handleConfirm">
              <img src="/images/Check.svg" alt="" />
            </button>
          </el-tooltip>
          <el-tooltip content="取消" placement="top">
            <button class="tool-btn danger" type="button" @click="handleCancel">
              <img src="/images/X.svg" alt="" />
            </button>
          </el-tooltip>
        </div>
      </div>

      <textarea
        v-if="textInput.visible"
        ref="textInputRef"
        v-model="textInput.value"
        class="annotation-text-input"
        :style="textInputStyle"
        placeholder="输入文字"
        rows="1"
        @input="resizeTextInput"
        @keydown="onTextInputKeydown"
      @pointerdown.stop
      />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Brush, Pointer, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'

type Rect = { x: number; y: number; width: number; height: number }
type NormalizedRect = { x: number; y: number; width: number; height: number }
type Tool = 'select' | 'rect' | 'circle' | 'arrow' | 'pen' | 'text'

type AnnotationBase = {
  color: string
  lineWidth: number
}

type RectAnnotation = AnnotationBase & {
  type: 'rect' | 'circle'
  x: number
  y: number
  width: number
  height: number
}

type ArrowAnnotation = AnnotationBase & {
  type: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
}

type PenAnnotation = AnnotationBase & {
  type: 'pen'
  points: { x: number; y: number }[]
}

type TextAnnotation = AnnotationBase & {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  lineHeight: number
  width: number
  height: number
}

type Annotation = RectAnnotation | ArrowAnnotation | PenAnnotation | TextAnnotation

type Action =
  | 'none'
  | 'selecting'
  | 'move-selection'
  | 'resize-selection'
  | 'draw'
  | 'move-annotation'
  | 'resize-annotation'

const props = defineProps<{
  visible: boolean
  baseImage: string | null
  captureRect: Rect | null
  autoSelectFull?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', value: { dataUrl: string; selection: NormalizedRect; overlayDataUrl?: string }): void
  (e: 'cancel'): void
}>()

const overlayRef = ref<HTMLDivElement | null>(null)
const annotationCanvasRef = ref<HTMLCanvasElement | null>(null)
const textInputRef = ref<HTMLTextAreaElement | null>(null)
const baseImageEl = ref<HTMLImageElement | null>(null)
const ctxRef = ref<CanvasRenderingContext2D | null>(null)
const dpr = window.devicePixelRatio || 1
const defaultTool: Tool = 'rect'
const tool = ref<Tool>(defaultTool)
const lineWidth = ref(2)
const color = ref('#ef4444')
const textBold = ref(false)
const textFontSize = ref(16)
const colors = ['#ef4444', '#facc15', '#3b82f6', '#22c55e', '#111827', '#ffffff']
const minSelectionWidth = 20
const minSelectionHeight = 20
const minTextFontSize = 12
const maxTextFontSize = 40
const selection = ref<Rect | null>(null)
const startPointer = ref({ x: 0, y: 0 })
const startSelection = ref<Rect | null>(null)
const startAnnotation = ref<Annotation | null>(null)
const activeAction = ref<Action>('none')
const activeHandle = ref<string | null>(null)
const activeAnnotationHandle = ref<string | null>(null)
const lastPointerId = ref<number | null>(null)
const annotations = ref<Annotation[]>([])
const historyStack = ref<Annotation[][]>([])
const redoStack = ref<Annotation[][]>([])
const currentDraft = ref<Annotation | null>(null)
const selectedIndex = ref<number | null>(null)
const editingIndex = ref<number | null>(null)
const applyingTextStyleState = ref(false)
const textInput = ref({
  visible: false,
  x: 0,
  y: 0,
  value: '',
})
const previousBodyOverflow = ref('')

const captureStyle = computed(() => {
  if (!props.captureRect) return {}
  return {
    left: `${props.captureRect.x}px`,
    top: `${props.captureRect.y}px`,
    width: `${props.captureRect.width}px`,
    height: `${props.captureRect.height}px`,
  }
})

const hasSelection = computed(() => Boolean(selection.value?.width && selection.value?.height))

const selectionStyle = computed(() => {
  if (!props.captureRect || !selection.value) return {}
  return {
    left: `${props.captureRect.x + selection.value.x}px`,
    top: `${props.captureRect.y + selection.value.y}px`,
    width: `${selection.value.width}px`,
    height: `${selection.value.height}px`,
  }
})

const selectionHandles = computed(() => {
  if (!props.captureRect || !selection.value) return []
  const size = 10
  const half = size / 2
  const x = props.captureRect.x + selection.value.x
  const y = props.captureRect.y + selection.value.y
  const w = selection.value.width
  const h = selection.value.height
  const cursorMap: Record<string, string> = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
  }
  return [
    { key: 'nw', style: { left: `${x - half}px`, top: `${y - half}px`, cursor: cursorMap.nw } },
    { key: 'ne', style: { left: `${x + w - half}px`, top: `${y - half}px`, cursor: cursorMap.ne } },
    { key: 'sw', style: { left: `${x - half}px`, top: `${y + h - half}px`, cursor: cursorMap.sw } },
    { key: 'se', style: { left: `${x + w - half}px`, top: `${y + h - half}px`, cursor: cursorMap.se } },
    { key: 'n', style: { left: `${x + w / 2 - half}px`, top: `${y - half}px`, cursor: cursorMap.n } },
    { key: 's', style: { left: `${x + w / 2 - half}px`, top: `${y + h - half}px`, cursor: cursorMap.s } },
    { key: 'w', style: { left: `${x - half}px`, top: `${y + h / 2 - half}px`, cursor: cursorMap.w } },
    { key: 'e', style: { left: `${x + w - half}px`, top: `${y + h / 2 - half}px`, cursor: cursorMap.e } },
  ]
})

const toolbarVisible = computed(() => hasSelection.value)

const toolbarStyle = computed(() => {
  if (!props.captureRect || !selection.value) return {}
  const { x, y, width, height } = selection.value
  const centerX = props.captureRect.x + x + width / 2
  let top = props.captureRect.y + y + height + 12
  const toolbarHeight = 48
  if (top + toolbarHeight > window.innerHeight - 8) {
    top = props.captureRect.y + y - toolbarHeight - 12
  }
  return {
    left: `${centerX}px`,
    top: `${Math.max(8, top)}px`,
    transform: 'translateX(-50%)',
  }
})

const textInputStyle = computed(() => {
  if (!props.captureRect || !textInput.value.visible) return {}
  return {
    left: `${props.captureRect.x + textInput.value.x}px`,
    top: `${props.captureRect.y + textInput.value.y}px`,
    color: color.value,
    fontWeight: textBold.value ? 'bold' : 'normal',
    fontSize: `${textFontSize.value}px`,
    lineHeight: `${Math.round(textFontSize.value * 1.4)}px`,
  }
})

const canUndo = computed(() => historyStack.value.length > 1)
const canRedo = computed(() => redoStack.value.length > 0)

const selectedAnnotationBounds = computed(() => {
  if (selectedIndex.value === null) return null
  const ann = annotations.value[selectedIndex.value]
  if (!ann) return null
  if (ann.type === 'rect' || ann.type === 'circle') {
    return normalizeRect(ann.x, ann.y, ann.x + ann.width, ann.y + ann.height)
  }
  return null
})

const selectedAnnotationHandles = computed(() => {
  if (!props.captureRect || !selectedAnnotationBounds.value) return []
  const size = 10
  const half = size / 2
  const { x, y, width, height } = selectedAnnotationBounds.value
  const left = props.captureRect.x + x
  const top = props.captureRect.y + y
  return [
    { key: 'nw', style: { left: `${left - half}px`, top: `${top - half}px` } },
    { key: 'ne', style: { left: `${left + width - half}px`, top: `${top - half}px` } },
    { key: 'sw', style: { left: `${left - half}px`, top: `${top + height - half}px` } },
    { key: 'se', style: { left: `${left + width - half}px`, top: `${top + height - half}px` } },
  ]
})

const setTool = (nextTool: Tool) => {
  tool.value = nextTool
  if (nextTool !== 'select') {
    selectedIndex.value = null
  }
}

const adjustTextFontSize = (delta: number) => {
  textFontSize.value = clamp(
    textFontSize.value + delta,
    minTextFontSize,
    maxTextFontSize,
  )
}

const syncTextStyleControlsFromAnnotation = (ann: Annotation | null | undefined) => {
  if (!ann || ann.type !== 'text') return
  applyingTextStyleState.value = true
  textBold.value = ann.fontWeight === 'bold'
  textFontSize.value = clamp(ann.fontSize, minTextFontSize, maxTextFontSize)
  nextTick(() => {
    applyingTextStyleState.value = false
  })
}

const applyDefaultSelection = () => {
  if (!props.autoSelectFull || !props.captureRect) return
  selection.value = {
    x: 0,
    y: 0,
    width: props.captureRect.width,
    height: props.captureRect.height,
  }
}

const resetState = () => {
  selection.value = null
  annotations.value = []
  historyStack.value = [[]]
  redoStack.value = []
  currentDraft.value = null
  selectedIndex.value = null
  editingIndex.value = null
  textInput.value = { visible: false, x: 0, y: 0, value: '' }
  activeAction.value = 'none'
  activeHandle.value = null
  activeAnnotationHandle.value = null
  tool.value = defaultTool
  lineWidth.value = 2
  color.value = '#ef4444'
  textBold.value = false
  textFontSize.value = 16
}

const syncCanvas = () => {
  if (!annotationCanvasRef.value || !props.captureRect) return
  const canvas = annotationCanvasRef.value
  canvas.width = Math.max(1, Math.floor(props.captureRect.width * dpr))
  canvas.height = Math.max(1, Math.floor(props.captureRect.height * dpr))
  canvas.style.width = `${props.captureRect.width}px`
  canvas.style.height = `${props.captureRect.height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctxRef.value = ctx
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const loadBaseImage = (url: string) => {
  const img = new Image()
  img.onload = () => {
    baseImageEl.value = img
    syncCanvas()
    redraw()
  }
  img.src = url
}

const getRelativePoint = (event: PointerEvent, clampOutOfBounds = false) => {
  if (!props.captureRect) return null
  const x = event.clientX - props.captureRect.x
  const y = event.clientY - props.captureRect.y
  if (!clampOutOfBounds) {
    if (x < 0 || y < 0 || x > props.captureRect.width || y > props.captureRect.height) {
      return null
    }
  }
  return {
    x: clamp(x, 0, props.captureRect.width),
    y: clamp(y, 0, props.captureRect.height),
  }
}

const pointInRect = (point: { x: number; y: number }, rect: Rect) =>
  point.x >= rect.x &&
  point.y >= rect.y &&
  point.x <= rect.x + rect.width &&
  point.y <= rect.y + rect.height

const normalizeRect = (x1: number, y1: number, x2: number, y2: number): Rect => {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  return {
    x: left,
    y: top,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const clampRect = (rect: Rect, bounds: Rect) => {
  const width = Math.min(rect.width, bounds.width)
  const height = Math.min(rect.height, bounds.height)
  const x = clamp(rect.x, 0, bounds.width - width)
  const y = clamp(rect.y, 0, bounds.height - height)
  return { x, y, width, height }
}

const clampPointToSelection = (point: { x: number; y: number }) => {
  if (!selection.value) return point
  return {
    x: clamp(point.x, selection.value.x, selection.value.x + selection.value.width),
    y: clamp(point.y, selection.value.y, selection.value.y + selection.value.height),
  }
}

const beginSelection = (point: { x: number; y: number }) => {
  selection.value = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  }
  activeAction.value = 'selecting'
  startPointer.value = { ...point }
  currentDraft.value = null
  selectedIndex.value = null
  annotations.value = []
  historyStack.value = [[]]
  redoStack.value = []
  redraw()
}

const updateSelection = (point: { x: number; y: number }) => {
  if (!selection.value || !props.captureRect) return
  const rect = normalizeRect(startPointer.value.x, startPointer.value.y, point.x, point.y)
  selection.value = clampRect(rect, {
    x: 0,
    y: 0,
    width: props.captureRect.width,
    height: props.captureRect.height,
  })
}

const finishSelection = () => {
  if (!selection.value) return
  if (selection.value.width < minSelectionWidth || selection.value.height < minSelectionHeight) {
    selection.value = null
  }
  activeAction.value = 'none'
}

const onSelectionHandleDown = (handle: string, event: PointerEvent) => {
  if (!selection.value || !props.captureRect) return
  activeAction.value = 'resize-selection'
  activeHandle.value = handle
  startPointer.value = getRelativePoint(event) || { x: 0, y: 0 }
  startSelection.value = { ...selection.value }
  capturePointer(event)
}

const onAnnotationHandleDown = (handle: string, event: PointerEvent) => {
  if (selectedIndex.value === null) return
  const ann = annotations.value[selectedIndex.value]
  if (!ann) return
  activeAnnotationHandle.value = handle
  activeAction.value = 'resize-annotation'
  startPointer.value = getRelativePoint(event) || { x: 0, y: 0 }
  startAnnotation.value = cloneAnnotation(ann)
  capturePointer(event)
}

const startMoveSelection = (point: { x: number; y: number }) => {
  if (!selection.value) return
  activeAction.value = 'move-selection'
  startPointer.value = point
  startSelection.value = { ...selection.value }
}

const startDraw = (point: { x: number; y: number }) => {
  activeAction.value = 'draw'
  startPointer.value = point
  selectedIndex.value = null
  if (tool.value === 'rect' || tool.value === 'circle') {
    currentDraft.value = {
      type: tool.value,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      color: color.value,
      lineWidth: lineWidth.value,
    }
  } else if (tool.value === 'arrow') {
    currentDraft.value = {
      type: 'arrow',
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      color: color.value,
      lineWidth: lineWidth.value,
    }
  } else if (tool.value === 'pen') {
    currentDraft.value = {
      type: 'pen',
      points: [point],
      color: color.value,
      lineWidth: lineWidth.value,
    }
  }
}

const startMoveAnnotation = (point: { x: number; y: number }, index: number) => {
  selectedIndex.value = index
  activeAction.value = 'move-annotation'
  startPointer.value = point
  startAnnotation.value = cloneAnnotation(annotations.value[index])
}

const updateSelectionResize = (point: { x: number; y: number }) => {
  if (!selection.value || !startSelection.value || !props.captureRect || !activeHandle.value) return
  const bounds = {
    minX: 0,
    minY: 0,
    maxX: props.captureRect.width,
    maxY: props.captureRect.height,
  }
  let left = startSelection.value.x
  let right = startSelection.value.x + startSelection.value.width
  let top = startSelection.value.y
  let bottom = startSelection.value.y + startSelection.value.height

  if (activeHandle.value.includes('w')) {
    left = clamp(point.x, bounds.minX, right - minSelectionWidth)
  }
  if (activeHandle.value.includes('e')) {
    right = clamp(point.x, left + minSelectionWidth, bounds.maxX)
  }
  if (activeHandle.value.includes('n')) {
    top = clamp(point.y, bounds.minY, bottom - minSelectionHeight)
  }
  if (activeHandle.value.includes('s')) {
    bottom = clamp(point.y, top + minSelectionHeight, bounds.maxY)
  }

  selection.value = {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

const updateAnnotationResize = (point: { x: number; y: number }) => {
  if (
    selectedIndex.value === null ||
    !startAnnotation.value ||
    !activeAnnotationHandle.value
  ) {
    return
  }
  const ann = annotations.value[selectedIndex.value]
  if (!ann || (ann.type !== 'rect' && ann.type !== 'circle')) return
  const base = startAnnotation.value as RectAnnotation
  const left = activeAnnotationHandle.value.includes('w') ? point.x : base.x
  const right = activeAnnotationHandle.value.includes('e') ? point.x : base.x + base.width
  const top = activeAnnotationHandle.value.includes('n') ? point.y : base.y
  const bottom = activeAnnotationHandle.value.includes('s') ? point.y : base.y + base.height
  const rect = normalizeRect(left, top, right, bottom)
  ann.x = rect.x
  ann.y = rect.y
  ann.width = Math.max(4, rect.width)
  ann.height = Math.max(4, rect.height)
  redraw()
}

const updateMoveSelection = (point: { x: number; y: number }) => {
  if (!selection.value || !startSelection.value || !props.captureRect) return
  const deltaX = point.x - startPointer.value.x
  const deltaY = point.y - startPointer.value.y
  const moved = {
    x: startSelection.value.x + deltaX,
    y: startSelection.value.y + deltaY,
    width: startSelection.value.width,
    height: startSelection.value.height,
  }
  selection.value = clampRect(moved, {
    x: 0,
    y: 0,
    width: props.captureRect.width,
    height: props.captureRect.height,
  })
}

const updateMoveAnnotation = (point: { x: number; y: number }) => {
  if (selectedIndex.value === null || !startAnnotation.value) return
  const ann = annotations.value[selectedIndex.value]
  const dx = point.x - startPointer.value.x
  const dy = point.y - startPointer.value.y
  if (ann.type === 'rect' || ann.type === 'circle') {
    ann.x = (startAnnotation.value as RectAnnotation).x + dx
    ann.y = (startAnnotation.value as RectAnnotation).y + dy
  } else if (ann.type === 'arrow') {
    ann.x1 = (startAnnotation.value as ArrowAnnotation).x1 + dx
    ann.y1 = (startAnnotation.value as ArrowAnnotation).y1 + dy
    ann.x2 = (startAnnotation.value as ArrowAnnotation).x2 + dx
    ann.y2 = (startAnnotation.value as ArrowAnnotation).y2 + dy
  } else if (ann.type === 'pen') {
    ann.points = (startAnnotation.value as PenAnnotation).points.map((p) => ({
      x: p.x + dx,
      y: p.y + dy,
    }))
  } else if (ann.type === 'text') {
    ann.x = (startAnnotation.value as TextAnnotation).x + dx
    ann.y = (startAnnotation.value as TextAnnotation).y + dy
  }
  redraw()
}

const updateDraft = (point: { x: number; y: number }) => {
  if (!currentDraft.value) return
  if (currentDraft.value.type === 'rect' || currentDraft.value.type === 'circle') {
    currentDraft.value.width = point.x - currentDraft.value.x
    currentDraft.value.height = point.y - currentDraft.value.y
  } else if (currentDraft.value.type === 'arrow') {
    currentDraft.value.x2 = point.x
    currentDraft.value.y2 = point.y
  } else if (currentDraft.value.type === 'pen') {
    currentDraft.value.points.push(point)
  }
  redraw()
}

const commitDraft = () => {
  if (!currentDraft.value) return
  const draft = currentDraft.value
  let next: Annotation | null = null
  if (draft.type === 'rect' || draft.type === 'circle') {
    const rect = normalizeRect(draft.x, draft.y, draft.x + draft.width, draft.y + draft.height)
    if (rect.width >= 4 && rect.height >= 4) {
      next = { ...draft, ...rect }
    }
  } else if (draft.type === 'arrow') {
    next = { ...draft }
  } else if (draft.type === 'pen') {
    if (draft.points.length > 1) {
      next = { ...draft, points: [...draft.points] }
    }
  }
  currentDraft.value = null
  if (next) {
    annotations.value = [...annotations.value, next]
    pushHistory()
  }
  redraw()
}

const openTextInput = (point: { x: number; y: number }, index?: number) => {
  if (textInput.value.visible) {
    commitText()
  }
  if (index !== undefined && index !== null) {
    const ann = annotations.value[index]
    if (ann && ann.type === 'text') {
      editingIndex.value = index
      color.value = ann.color
      syncTextStyleControlsFromAnnotation(ann)
      textInput.value = { visible: true, x: ann.x, y: ann.y, value: ann.text }
      nextTick(() => {
        textInputRef.value?.focus()
        resizeTextInput()
      })
      return
    }
  }
  editingIndex.value = null
  textInput.value = { visible: true, x: point.x, y: point.y, value: '' }
  nextTick(() => {
    textInputRef.value?.focus()
    resizeTextInput()
  })
}

const cancelText = () => {
  textInput.value = { visible: false, x: 0, y: 0, value: '' }
  editingIndex.value = null
}

const measureTextBlock = (
  text: string,
  fontWeight: 'normal' | 'bold',
  fontSize: number,
) => {
  const ctx = ctxRef.value
  const lines = text.split('\n')
  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px "PingFang SC", sans-serif`
  }
  const widths = lines.map((line) => {
    if (ctx) return ctx.measureText(line || ' ').width
    return Math.max(8, line.length * 8)
  })
  const width = Math.max(8, ...widths)
  const lineHeight = Math.round(fontSize * 1.4)
  const height = Math.max(lineHeight, lineHeight * lines.length)
  return { width, height, lineHeight, lines }
}

const resizeTextInput = () => {
  const el = textInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const onTextInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    commitText()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelText()
  }
}

const commitText = () => {
  if (!textInput.value.visible) return
  const value = textInput.value.value.trim()
  if (!value) {
    cancelText()
    return
  }
  const fontSize = textFontSize.value
  const fontWeight = textBold.value ? 'bold' : 'normal'
  const { width, height, lineHeight } = measureTextBlock(value, fontWeight, fontSize)
  if (editingIndex.value !== null) {
    const ann = annotations.value[editingIndex.value]
    if (ann && ann.type === 'text') {
      ann.text = value
      ann.fontSize = fontSize
      ann.fontWeight = fontWeight
      ann.width = width
      ann.height = height
      ann.lineHeight = lineHeight
      ann.color = color.value
      ann.lineWidth = lineWidth.value
    }
  } else {
    annotations.value = [
      ...annotations.value,
      {
        type: 'text',
        x: textInput.value.x,
        y: textInput.value.y,
        text: value,
        fontSize,
        fontWeight,
        lineHeight,
        width,
        height,
        color: color.value,
        lineWidth: lineWidth.value,
      },
    ]
  }
  pushHistory()
  cancelText()
  redraw()
}

const pushHistory = () => {
  historyStack.value.push(cloneAnnotations(annotations.value))
  redoStack.value = []
}

const handleUndo = () => {
  if (!canUndo.value) return
  const current = historyStack.value.pop()
  if (current) redoStack.value.push(current)
  const previous = historyStack.value[historyStack.value.length - 1] || []
  annotations.value = cloneAnnotations(previous)
  selectedIndex.value = null
  redraw()
}

const handleRedo = () => {
  if (!canRedo.value) return
  const next = redoStack.value.pop()
  if (!next) return
  historyStack.value.push(cloneAnnotations(next))
  annotations.value = cloneAnnotations(next)
  selectedIndex.value = null
  redraw()
}

const findAnnotationAt = (point: { x: number; y: number }) => {
  for (let i = annotations.value.length - 1; i >= 0; i -= 1) {
    const ann = annotations.value[i]
    if (isPointOnAnnotation(point, ann)) return i
  }
  return null
}

const isPointOnAnnotation = (point: { x: number; y: number }, ann: Annotation) => {
  if (ann.type === 'rect' || ann.type === 'circle') {
    return pointInRect(point, normalizeRect(ann.x, ann.y, ann.x + ann.width, ann.y + ann.height))
  }
  if (ann.type === 'arrow') {
    return pointToSegmentDistance(point, { x: ann.x1, y: ann.y1 }, { x: ann.x2, y: ann.y2 }) < 6
  }
  if (ann.type === 'pen') {
    for (let i = 0; i < ann.points.length - 1; i += 1) {
      const p1 = ann.points[i]
      const p2 = ann.points[i + 1]
      if (pointToSegmentDistance(point, p1, p2) < 6) return true
    }
    return false
  }
  if (ann.type === 'text') {
    return pointInRect(point, {
      x: ann.x,
      y: ann.y,
      width: ann.width,
      height: ann.height,
    })
  }
  return false
}

const pointToSegmentDistance = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
  const clamped = clamp(t, 0, 1)
  const x = a.x + clamped * dx
  const y = a.y + clamped * dy
  return Math.hypot(p.x - x, p.y - y)
}

const redraw = () => {
  const canvas = annotationCanvasRef.value
  const ctx = ctxRef.value
  if (!canvas || !ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  annotations.value.forEach((ann) => drawAnnotation(ctx, ann))
  if (currentDraft.value) drawAnnotation(ctx, currentDraft.value)
}

const drawAnnotation = (
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  offset: { x: number; y: number } = { x: 0, y: 0 },
) => {
  ctx.save()
  ctx.lineWidth = ann.lineWidth
  ctx.strokeStyle = ann.color
  ctx.fillStyle = ann.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (ann.type === 'rect') {
    const rect = normalizeRect(ann.x, ann.y, ann.x + ann.width, ann.y + ann.height)
    ctx.strokeRect(rect.x + offset.x, rect.y + offset.y, rect.width, rect.height)
  } else if (ann.type === 'circle') {
    const rect = normalizeRect(ann.x, ann.y, ann.x + ann.width, ann.y + ann.height)
    const cx = rect.x + rect.width / 2 + offset.x
    const cy = rect.y + rect.height / 2 + offset.y
    const rx = rect.width / 2
    const ry = rect.height / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (ann.type === 'arrow') {
    drawArrow(ctx, ann.x1 + offset.x, ann.y1 + offset.y, ann.x2 + offset.x, ann.y2 + offset.y)
  } else if (ann.type === 'pen') {
    ctx.beginPath()
    ann.points.forEach((p, idx) => {
      const x = p.x + offset.x
      const y = p.y + offset.y
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  } else if (ann.type === 'text') {
    ctx.font = `${ann.fontWeight} ${ann.fontSize}px "PingFang SC", sans-serif`
    ctx.textBaseline = 'top'
    const lineHeight = ann.lineHeight || Math.round(ann.fontSize * 1.4)
    const lines = ann.text.split('\n')
    lines.forEach((line, idx) => {
      ctx.fillText(line, ann.x + offset.x, ann.y + offset.y + idx * lineHeight)
    })
  }
  ctx.restore()
}

const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const headLength = 10 + ctx.lineWidth * 1.5
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()
}

const getAnnotationBounds = (ann: Annotation) => {
  if (ann.type === 'rect' || ann.type === 'circle') {
    return normalizeRect(ann.x, ann.y, ann.x + ann.width, ann.y + ann.height)
  }
  if (ann.type === 'arrow') {
    return normalizeRect(ann.x1, ann.y1, ann.x2, ann.y2)
  }
  if (ann.type === 'pen') {
    if (!ann.points.length) return null
    let minX = ann.points[0].x
    let minY = ann.points[0].y
    let maxX = ann.points[0].x
    let maxY = ann.points[0].y
    ann.points.forEach((p) => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })
    return normalizeRect(minX, minY, maxX, maxY)
  }
  if (ann.type === 'text') {
    return {
      x: ann.x,
      y: ann.y,
      width: ann.width,
      height: ann.height,
    }
  }
  return null
}

const cloneAnnotation = (ann: Annotation): Annotation => JSON.parse(JSON.stringify(ann))
const cloneAnnotations = (list: Annotation[]) => list.map((ann) => cloneAnnotation(ann))

const capturePointer = (event: PointerEvent) => {
  lastPointerId.value = event.pointerId
  overlayRef.value?.setPointerCapture(event.pointerId)
}

const cleanupInteraction = () => {
  if (
    lastPointerId.value !== null &&
    overlayRef.value?.hasPointerCapture(lastPointerId.value)
  ) {
    overlayRef.value.releasePointerCapture(lastPointerId.value)
  }
  lastPointerId.value = null
  activeAction.value = 'none'
  activeHandle.value = null
  activeAnnotationHandle.value = null
  currentDraft.value = null
  textInput.value = { visible: false, x: 0, y: 0, value: '' }
  editingIndex.value = null
}

const ensureBaseImage = async (): Promise<HTMLImageElement | null> => {
  if (baseImageEl.value && baseImageEl.value.complete && baseImageEl.value.naturalWidth) {
    return baseImageEl.value
  }
  if (!props.baseImage) return null
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = props.baseImage as string
  })
}

const handleConfirm = async () => {
  cleanupInteraction()
  if (!props.captureRect || !selection.value) {
    ElMessage.warning('请先选择截图区域')
    return
  }
  const baseImage = await ensureBaseImage()
  if (!baseImage) {
    ElMessage.warning('截图底图未就绪，请重试')
    return
  }
  const output = document.createElement('canvas')
  output.width = Math.round(selection.value.width)
  output.height = Math.round(selection.value.height)
  const ctx = output.getContext('2d')
  if (!ctx) return
  const sourceWidth = baseImage.naturalWidth || baseImage.width
  const sourceHeight = baseImage.naturalHeight || baseImage.height
  // Draw full base image scaled to the capture rect, then offset so the selection area stays in view.
  ctx.drawImage(
    baseImage,
    0,
    0,
    sourceWidth,
    sourceHeight,
    -selection.value.x,
    -selection.value.y,
    props.captureRect.width,
    props.captureRect.height,
  )
  ctx.save()
  ctx.translate(-selection.value.x, -selection.value.y)
  annotations.value.forEach((ann) => drawAnnotation(ctx, ann))
  ctx.restore()
  const dataUrl = output.toDataURL('image/png')
  const overlay = document.createElement('canvas')
  overlay.width = output.width
  overlay.height = output.height
  const overlayCtx = overlay.getContext('2d')
  let overlayDataUrl: string | undefined
  if (overlayCtx) {
    overlayCtx.save()
    overlayCtx.translate(-selection.value.x, -selection.value.y)
    annotations.value.forEach((ann) => drawAnnotation(overlayCtx, ann))
    overlayCtx.restore()
    overlayDataUrl = overlay.toDataURL('image/png')
  }
  const selectionRatio = {
    x: selection.value.x / props.captureRect.width,
    y: selection.value.y / props.captureRect.height,
    width: selection.value.width / props.captureRect.width,
    height: selection.value.height / props.captureRect.height,
  }
  emit('confirm', { dataUrl, selection: selectionRatio, overlayDataUrl })
}

const handleCancel = () => {
  cleanupInteraction()
  emit('cancel')
}

const onOverlayPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  if (!props.captureRect) return
  const target = event.target as HTMLElement
  if (textInput.value.visible) {
    if (target.closest('.annotation-text-input') || target.closest('.annotation-toolbar')) {
      return
    }
    // 点击外部：提交（无内容会自动 cancel）
    commitText()
    return
  }
  if (target.closest('.annotation-toolbar') || target.closest('.annotation-text-input')) return
  const point = getRelativePoint(event)
  if (!point) return

  if (!selection.value) {
    beginSelection(point)
    capturePointer(event)
    return
  }

  const insideSelection = pointInRect(point, selection.value)
  if (tool.value === 'select') {
    const hitIndex = insideSelection ? findAnnotationAt(point) : null
    if (hitIndex !== null) {
      startMoveAnnotation(point, hitIndex)
      capturePointer(event)
      redraw()
      return
    }
    if (insideSelection) {
      startMoveSelection(point)
      capturePointer(event)
      return
    }
    beginSelection(point)
    capturePointer(event)
    return
  }

  if (!insideSelection) return

  if (tool.value === 'text') {
    const hitIndex = insideSelection ? findAnnotationAt(point) : null
    if (hitIndex !== null && annotations.value[hitIndex]?.type === 'text') {
      selectedIndex.value = hitIndex
      redraw()
      return
    }
    openTextInput(point)
    return
  }

  startDraw(clampPointToSelection(point))
  capturePointer(event)
}

const onOverlayDoubleClick = (event: MouseEvent) => {
  if (!props.captureRect || textInput.value.visible) return
  const point = getRelativePoint(event as PointerEvent)
  if (!point || !selection.value) return
  if (!pointInRect(point, selection.value)) return
  const hitIndex = findAnnotationAt(point)
  if (hitIndex !== null && annotations.value[hitIndex]?.type === 'text') {
    openTextInput(point, hitIndex)
  }
}

const onOverlayKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
    return
  }
  if (textInput.value.visible) return
  if (event.key === 'Enter') {
    if (selectedIndex.value !== null && annotations.value[selectedIndex.value]?.type === 'text') {
      event.preventDefault()
      const ann = annotations.value[selectedIndex.value]
      if (ann && ann.type === 'text') {
        openTextInput({ x: ann.x, y: ann.y }, selectedIndex.value)
      }
    }
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIndex.value !== null) {
    event.preventDefault()
    annotations.value = annotations.value.filter((_, idx) => idx !== selectedIndex.value)
    selectedIndex.value = null
    pushHistory()
    redraw()
  }
}

const onOverlayPointerMove = (event: PointerEvent) => {
  let point = getRelativePoint(event, true)
  if (!point) return
  if (activeAction.value === 'draw') {
    point = clampPointToSelection(point)
  }
  if (activeAction.value === 'selecting') {
    updateSelection(point)
  } else if (activeAction.value === 'move-selection') {
    updateMoveSelection(point)
  } else if (activeAction.value === 'resize-selection') {
    updateSelectionResize(point)
  } else if (activeAction.value === 'draw') {
    updateDraft(point)
  } else if (activeAction.value === 'move-annotation') {
    updateMoveAnnotation(point)
  } else if (activeAction.value === 'resize-annotation') {
    updateAnnotationResize(point)
  }
}

const onOverlayPointerUp = (event?: PointerEvent) => {
  if (activeAction.value === 'selecting') {
    finishSelection()
  } else if (activeAction.value === 'draw') {
    commitDraft()
  } else if (activeAction.value === 'move-annotation') {
    pushHistory()
  } else if (activeAction.value === 'resize-annotation') {
    pushHistory()
  }
  activeAction.value = 'none'
  activeHandle.value = null
  activeAnnotationHandle.value = null
  if (event?.pointerId && overlayRef.value?.hasPointerCapture(event.pointerId)) {
    overlayRef.value.releasePointerCapture(event.pointerId)
  }
  if (event?.pointerId && lastPointerId.value === event.pointerId) {
    lastPointerId.value = null
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      cleanupInteraction()
      resetState()
      applyDefaultSelection()
      previousBodyOverflow.value = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      nextTick(() => {
        syncCanvas()
        redraw()
        overlayRef.value?.focus()
      })
      return
    }
    cleanupInteraction()
    resetState()
    document.body.style.overflow = previousBodyOverflow.value
  },
)

watch(
  () => props.baseImage,
  (url) => {
    if (!url) return
    resetState()
    applyDefaultSelection()
    loadBaseImage(url)
  },
  { immediate: true },
)

watch(
  () => props.captureRect,
  () => {
    if (!selection.value) {
      applyDefaultSelection()
    }
    syncCanvas()
    redraw()
  },
)

watch(color, (value) => {
  if (tool.value !== 'select' || selectedIndex.value === null) return
  const ann = annotations.value[selectedIndex.value]
  if (!ann) return
  ann.color = value
  pushHistory()
  redraw()
})

watch(lineWidth, (value) => {
  if (tool.value !== 'select' || selectedIndex.value === null) return
  const ann = annotations.value[selectedIndex.value]
  if (!ann) return
  ann.lineWidth = value
  pushHistory()
  redraw()
})

watch(textBold, (value) => {
  if (applyingTextStyleState.value) return
  if (tool.value !== 'select' || selectedIndex.value === null) return
  const ann = annotations.value[selectedIndex.value]
  if (!ann || ann.type !== 'text') return
  ann.fontWeight = value ? 'bold' : 'normal'
  const metrics = measureTextBlock(ann.text, ann.fontWeight, ann.fontSize)
  ann.width = metrics.width
  ann.height = metrics.height
  ann.lineHeight = metrics.lineHeight
  pushHistory()
  redraw()
})

watch(textFontSize, (value) => {
  if (textInput.value.visible) {
    nextTick(() => resizeTextInput())
  }
  if (applyingTextStyleState.value) return
  if (tool.value !== 'select' || selectedIndex.value === null) return
  const ann = annotations.value[selectedIndex.value]
  if (!ann || ann.type !== 'text') return
  ann.fontSize = value
  const metrics = measureTextBlock(ann.text, ann.fontWeight, ann.fontSize)
  ann.width = metrics.width
  ann.height = metrics.height
  ann.lineHeight = metrics.lineHeight
  pushHistory()
  redraw()
})

watch(selectedIndex, (value) => {
  if (value === null) return
  syncTextStyleControlsFromAnnotation(annotations.value[value])
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow.value
})
</script>

<style scoped>
.screenshot-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
  cursor: crosshair;
  user-select: none;
  touch-action: none;
}

.screen-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 12;
  pointer-events: none;
}

.screenshot-overlay.text-tool-active {
  cursor: text;
}

.screenshot-base {
  position: absolute;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
  z-index: 10;
}

.annotation-canvas {
  position: absolute;
  pointer-events: none;
  z-index: 15;
}

.selection-rect {
  position: absolute;
  border: 2px solid #22c55e;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.5);
  border-radius: 6px;
  pointer-events: auto;
  z-index: 20;
}

.selection-handle-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.selection-handle,
.annotation-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #22c55e;
  border: 1px solid #0f172a;
  box-sizing: border-box;
  pointer-events: auto;
  cursor: pointer;
}

.annotation-handle-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.annotation-handle {
  background: #38bdf8;
  border-color: #0f172a;
}

.annotation-toolbar {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
  z-index: 50;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.tool-btn img {
  width: 18px;
  height: 18px;
}

.text-size-btn {
  min-width: 40px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 700;
}

.text-size-indicator {
  min-width: 28px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tool-btn.active {
  border-color: rgba(34, 197, 94, 0.9);
  background: rgba(34, 197, 94, 0.15);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.35);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn.primary {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.6);
}

.tool-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
}

.tool-rect-icon {
  width: 18px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 2px;
}

.colors .color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
  cursor: pointer;
}

.colors .color-dot.active {
  border-color: #fff;
  transform: scale(1.05);
}

.colors .color-dot.light {
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.6);
}
:deep(.annotation-text-input){
  position: fixed;
  z-index: 999999;
  min-width: 60px;
  max-width: min(420px, 70vw);
  min-height: 28px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(64, 158, 255, 0.85);
  background: rgba(255, 255, 255, 0.96);
  color: rgba(0, 0, 0, 0.9);
  font-size: 16px;
  line-height: 1.4;
  font-family: "PingFang SC", sans-serif;
  outline: none;
  cursor: text;
  user-select: text;
  resize: none;
  overflow: hidden;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
}
</style>
