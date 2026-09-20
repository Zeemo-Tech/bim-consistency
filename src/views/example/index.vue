<template>
  <div
    ref="containerEl"
    class="BimPointcloudAlign-container"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="topbar">
      <div class="brand"></div>
      <div class="actions">
        <input
          ref="fileInputEl"
          class="file"
          type="file"
          :accept="acceptFileTypes"
          :disabled="!canSelectFile"
          @change="onFileChange"
        />
        <button
          type="button"
          class="btn"
          :disabled="!webgpuSupported || !canSelectFile"
          @click="openFilePicker"
        >
          上传 BIM (IFC)
        </button>
        <button type="button" class="btn" @click="showPanel = !showPanel">
          {{ showPanel ? '收起面板' : '展开面板' }}
        </button>
        <button type="button" class="btn" @click="showTreePanel = !showTreePanel">
          {{ showTreePanel ? '隐藏构件树' : '显示构件树' }}
        </button>
      </div>
    </div>

    <div class="tree-panel" :class="{ 'is-collapsed': !showTreePanel }">
      <div class="tree-panel-header">
        <div class="tree-panel-title">构件树</div>
        <div class="tree-panel-count">{{ bimTreePanels.length }} 个模型</div>
        <button type="button" class="tree-panel-close" @click="showTreePanel = false">
          收起
        </button>
      </div>
      <div class="tree-panel-body">
        <div v-if="!bimTreePanels.length" class="tree-empty">
          暂无模型，加载 BIM 后自动生成构件树
        </div>
        <div v-for="panel in bimTreePanels" :key="panel.fileId" class="tree-group">
          <div class="tree-group-header" @click="toggleTreeGroup(panel.fileId)">
            <div class="tree-group-title">
              <span class="tree-group-caret">{{ panel.expanded ? '▾' : '▸' }}</span>
              <span class="tree-group-name">{{ panel.label }}</span>
            </div>
            <div class="tree-group-meta">
              <span class="tree-group-count">{{ panel.nodeCount }} 节点</span>
            </div>
          </div>
          <div v-show="panel.expanded" class="tree-group-body">
            <div class="tree-group-actions">
              <button
                type="button"
                class="tree-action"
                @click.stop="setTreeAll(panel.fileId, true)"
              >
                全选
              </button>
              <button
                type="button"
                class="tree-action"
                @click.stop="setTreeAll(panel.fileId, false)"
              >
                隐藏
              </button>
            </div>
            <div v-if="panel.loading" class="tree-loading">加载构件树...</div>
            <div v-else-if="!panel.treeData.length" class="tree-empty-small">
              暂无构件数据
            </div>
            <el-tree
              v-else
              :data="panel.treeData"
              :props="treeProps"
              node-key="id"
              :default-expanded-keys="panel.defaultExpandedKeys"
              :show-checkbox="true"
              :expand-on-click-node="false"
              :check-on-click-node="false"
              :highlight-current="true"
              @node-click="(data) => handleTreeNodeClick(panel.fileId, data)"
              @check="(_, info) => handleTreeCheck(panel.fileId, info)"
              :ref="(el) => setTreeRef(panel.fileId, el)"
            >
              <template #default="{ node, data }">
                <div class="tree-node-content">
                  <span class="tree-node-label">{{ node.label }}</span>
                  <span v-if="data.stepId" class="tree-node-tag">#{{ data.stepId }}</span>
                </div>
              </template>
            </el-tree>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPanel" class="panel">
      <div class="panelTitle">控制面板</div>

      <div class="row">
        <div class="label">选择项目</div>
        <label class="select" style="flex: 1">
          <select v-model="selectedProjectId" :disabled="isUploading">
            <option value="">请选择项目</option>
            <option v-for="project in projectList" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </label>
        <button type="button" class="btn subtle" :disabled="isUploading" @click="loadProjectList">
          刷新
        </button>
      </div>

      <!-- 文件类型固定为 BIM，不展示选择器 -->
      <div
        v-if="selectedFileType === 'BIM'"
        class="row"
        :class="{ disabled: !canSelectExistingBim }"
      >
        <div class="label">已上传 BIM</div>
        <div class="bim-select">
          <label class="bim-check-all">
            <input
              type="checkbox"
              :checked="allBimSelected"
              :indeterminate="bimSelectIndeterminate"
              :disabled="!canSelectExistingBim"
              @change="toggleSelectAllBim"
            />
            <span>全选</span>
          </label>
          <div class="bim-checklist">
            <label
              v-for="file in existingBimFiles"
              :key="file.id"
              class="bim-check-item"
            >
              <input
                v-model="selectedExistingBimIds"
                type="checkbox"
                :value="file.id"
                :disabled="!canSelectExistingBim"
              />
              <span class="bim-check-label">{{ file.label }}</span>
              <span v-if="isBimLoaded(file.id)" class="bim-check-tag">已加载</span>
            </label>
            <div v-if="!existingBimFiles.length" class="bim-empty">暂无 BIM 文件</div>
          </div>
        </div>

      </div>
      <button
          type="button"
          class="btn"
          :disabled="!canLoadExistingBim"
          @click="loadSelectedExistingBims"
        >
          加载
        </button>
      <div class="row">
        <div class="label">已上传</div>
        <div
          class="mono"
          style="
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          "
        >
          {{ uploadedNamesText }}
        </div>
      </div>
      <div class="hint2">当前仅支持 BIM（.ifc）上传</div>

      <div class="row">
        <div class="label">材质</div>
        <label class="select">
          <select
            v-model="materialMode"
            :disabled="!hasModel"
            @change="onMaterialModeChange"
          >
            <option value="original">Original</option>
            <option value="unlit">TSL Unlit</option>
            <option value="lambert">TSL Lit (Lambert)</option>
          </select>
        </label>
      </div>

      <div class="row">
        <div class="label">调试</div>
        <label class="toggle">
          <input v-model="enableDebugLogs" type="checkbox" />
          <span>Debug logs</span>
        </label>
      </div>

      <div class="row">
        <div class="label">构件</div>
        <label class="toggle">
          <input v-model="enableElementPicking" type="checkbox" />
          <span>点击高亮</span>
        </label>
      </div>

      <div
        class="row"
        :class="{ disabled: !enableElementPicking || !hasModel }"
      >
        <div class="label">已选构件</div>
        <div
          class="mono"
          style="
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          "
        >
          {{ pickedElementText }}
        </div>
        <button
          type="button"
          class="btn subtle"
          :disabled="!enableElementPicking || !pickedElement"
          @click="clearPickedElement"
        >
          清除
        </button>
      </div>
      <div class="hint2">
        非编辑模式：点击构件高亮；编辑模式：Alt + 点击构件
      </div>

      <div class="row">
        <div class="label">编辑</div>
        <label class="toggle">
          <input
            v-model="editMode"
            type="checkbox"
            @change="onEditModeChange"
          />
          <span>编辑模式</span>
        </label>
      </div>

      <div class="row" :class="{ disabled: !editMode || !loadedItems.length }">
        <div class="label">选择对象</div>
        <label class="select">
          <select
            v-model="selectedItemId"
            :disabled="!editMode || !loadedItems.length"
            @change="onSelectedItemChange"
          >
            <option v-for="it in loadedItems" :key="it.id" :value="it.id">
              {{ it.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="btn"
          :disabled="!editMode || !selectedItemId"
          @click="focusSelected"
        >
          定位
        </button>
      </div>

      <div class="row" :class="{ disabled: !editMode }">
        <div class="label">变换</div>
        <div class="modes">
          <button
            v-for="mode in transformModes"
            :key="mode.value"
            type="button"
            class="btn"
            :class="{ active: transformMode === mode.value }"
            :disabled="!editMode"
            @click="setTransformMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
        <div class="modes">
          <button
            v-for="space in transformSpaces"
            :key="space.value"
            type="button"
            class="btn"
            :class="{ active: transformSpace === space.value }"
            :disabled="!editMode"
            @click="setTransformSpace(space.value)"
          >
            {{ space.label }}
          </button>
        </div>
        <div class="hint2">编辑模式下可点击画布选中对象</div>
      </div>

      <div class="row" :class="{ disabled: !editMode || !selectedItemId }">
        <div class="label">Orientation 修正 (deg)</div>
        <label class="slider" :class="{ disabled: !editMode || !selectedItemId }">
          <span class="axis">X</span>
          <input
            v-model.number="orientationDegX"
            type="range"
            min="-180"
            max="180"
            step="1"
            :disabled="!editMode || !selectedItemId"
            @input="applyOrientationFixRealtime"
          />
          <span class="val wide">{{ orientationDegX }}</span>
        </label>
        <label class="slider" :class="{ disabled: !editMode || !selectedItemId }">
          <span class="axis">Y</span>
          <input
            v-model.number="orientationDegY"
            type="range"
            min="-180"
            max="180"
            step="1"
            :disabled="!editMode || !selectedItemId"
            @input="applyOrientationFixRealtime"
          />
          <span class="val wide">{{ orientationDegY }}</span>
        </label>
        <label class="slider" :class="{ disabled: !editMode || !selectedItemId }">
          <span class="axis">Z</span>
          <input
            v-model.number="orientationDegZ"
            type="range"
            min="-180"
            max="180"
            step="1"
            :disabled="!editMode || !selectedItemId"
            @input="applyOrientationFixRealtime"
          />
          <span class="val wide">{{ orientationDegZ }}</span>
        </label>
        <button
          type="button"
          class="btn subtle"
          :disabled="!editMode || !selectedItemId"
          @click="bakeOrientationFixToSelected()"
        >
          应用
        </button>
      </div>

      <div class="row">
        <div class="label">辅助</div>
        <label class="toggle">
          <input v-model="showGrid" type="checkbox" @change="onShowGridChange" />
          <span>网格</span>
        </label>
        <label class="toggle">
          <input v-model="showBounds" type="checkbox" />
          <span>包围盒</span>
        </label>
      </div>

      <div class="row buttons">
        <button
          type="button"
          class="btn"
          :disabled="!hasModel"
          @click="setFrontView"
        >
          前视图
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!hasModel"
          @click="setTopView"
        >
          俯视图
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!hasModel"
          @click="setSideView"
        >
          侧视图
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!hasModel"
          @click="resetView"
        >
          重置视角
        </button>
        <button
          type="button"
          class="btn subtle"
          :disabled="!hasModel"
          @click="clearScene"
        >
          清空场景
        </button>
      </div>
    </div>

    <div class="status">
      <div class="pill" :class="{ warn: !webgpuSupported }">
        {{ statusText }}
      </div>
    </div>

    <div v-if="isDragging" class="dropMask">
      <div class="dropCard">松开以上传 IFC</div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'BimPointcloudAlign', //组件名称
})
</script>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import Stats from 'three/addons/libs/stats.module.js'
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  NodeMaterial,
  WebGPURenderer,
} from 'three/webgpu'
import { color as tslColor, vertexColor as tslVertexColor } from 'three/tsl'
import { getIfcGlbFile, getIfcMetadata, getProjectFilesByProjectId, type ProjectFile } from '@/api/fileManage'
import { getAllProjects } from '@/api/project'

/**
 * gltf-web-demo (WebGPU) 说明
 * ==========================
 *
 * 这是一个基于 three.js WebGPU 渲染管线的轻量 Viewer，核心目标：
 * 1) 上传 IFC → 服务端转换为 GLB → 加载显示
 * 2) 以“构件”为粒度进行点选高亮（支持 BatchedMesh 合批后的 instance）
 * 3) 导入 metadata.json（ifc_bundle 格式），展示构件树与属性，并与 3D 点选/显隐联动
 *
 * 整体架构（数据流）
 * -----------------
 * - GLB 加载：
 *   - GLTFLoader 加载 root → applyMaterialMode → optimizeRoot（将可合批 Mesh 合成 BatchedMesh）
 *   - fitCameraToObject 做重心归零（便于 orbit/scale）
 *   - rebuildElementIndex：构建 elementId → (Mesh 或 BatchedMesh instance) 的索引，用于“树 → 3D”
 *
 * - Metadata 导入：
 *   - 读取 metadata.json，构建 stepId → GlobalId 映射（兼容 tree.id 为 "#<STEP_ID>"）
 *   - 基于 tree 生成“节点实例”的唯一 key（__viewerNodeKey），避免重复 id（如 __unassigned__ 分支）覆盖
 *   - 为每个 tree 节点缓存其子树下所有 element GlobalId（用于父节点批量显隐）
 *   - 为每个 elementId 选一个“优先树节点”（用于 3D 点选后定位到树中正确分支）
 *
 * - 交互联动：
 *   - 3D → Tree：点击构件 → 推断 elementId → 选中 metadata.elements[elementId] → 定位/展开树节点
 *   - Tree → 3D：点击树节点（若该节点对应 elementId）→ 高亮 3D 构件（不自动相机聚焦）
 *   - Tree 显隐：勾选/取消勾选任意节点 → 取其子树 elementId 列表 → best effort 隐藏/显示
 *
 * 性能要点（最关键）
 * -----------------
 * 本项目能流畅显示大型 IFC→GLB 的核心在于“合批（batch）”：
 * - `optimizeRoot()` 会将大量可合并的 Mesh 转为 `THREE.BatchedMesh`（按材质 + 属性布局分组）
 * - 这会显著降低 drawcall/CPU 开销，是性能影响最大的优化点
 * - 因此“构件级点选/显隐/高亮”必须同时支持普通 Mesh 与 BatchedMesh instance（依赖 batchId）
 *
 * 注意：为了在 WebGPU + NodeMaterial 模式下稳定高亮，本项目采用“覆盖层 overlay mesh”高亮策略，
 * 避免对材质 clone/copy 引起的循环引用序列化问题（Material.copy 会 JSON stringify userData）。
 */

const containerEl = ref<HTMLDivElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const route = useRoute()

// 基础 UI 状态（面板、调试、模式切换）
const webgpuSupported = computed(
  () => typeof navigator !== 'undefined' && 'gpu' in navigator,
)
const statusText = ref<string>('')
const isDragging = ref(false)
const isUploading = ref(false)
const projectList = ref<Array<{ id: number; name: string }>>([])
const selectedProjectId = ref('')
const selectedFileType = ref<'BIM' | 'CAD' | 'scan'>('BIM')
const existingBimFiles = ref<Array<{ id: string; label: string }>>([])
const selectedExistingBimIds = ref<string[]>([])
const hasModel = ref(false)
const materialMode = ref<'original' | 'unlit' | 'lambert'>('unlit')
const enableDebugLogs = ref(false)
const canSelectFile = computed(() => {
  return (
    webgpuSupported.value &&
    !!selectedProjectId.value &&
    selectedFileType.value === 'BIM' &&
    !isUploading.value
  )
})
const canSelectExistingBim = computed(() => {
  return (
    !!selectedProjectId.value &&
    selectedFileType.value === 'BIM' &&
    !isUploading.value
  )
})
const canLoadExistingBim = computed(() => {
  return canSelectExistingBim.value && selectedExistingBimIds.value.length > 0
})
const loadedBimIdSet = computed(() => {
  const set = new Set<string>()
  for (const item of loadedItems.value) {
    if (item.fileId) set.add(String(item.fileId))
  }
  return set
})
const loadableBimIds = computed(() => {
  return existingBimFiles.value
    .filter((file) => !loadedBimIdSet.value.has(file.id))
    .map((file) => file.id)
})
const allBimSelected = computed(() => {
  if (!loadableBimIds.value.length) return false
  return loadableBimIds.value.every((id) => selectedExistingBimIds.value.includes(id))
})
const bimSelectIndeterminate = computed(() => {
  const selectedLoadable = selectedExistingBimIds.value.filter((id) =>
    loadableBimIds.value.includes(id),
  )
  return selectedLoadable.length > 0 && selectedLoadable.length < loadableBimIds.value.length
})
const acceptFileTypes = computed(() => {
  if (selectedFileType.value === 'BIM') return '.ifc,.IFC'
  if (selectedFileType.value === 'CAD') return '.dwg,.dxf,.DWG,.DXF'
  if (selectedFileType.value === 'scan') return '.zip,.ZIP'
  return ''
})
const showPanel = ref(true)
const showTreePanel = ref(true)
const showBounds = ref(false)
const showGrid = ref(true)
const editMode = ref(false)
const transformMode = ref<'translate' | 'rotate'>('translate')
const transformSpace = ref<'world' | 'local'>('world')

// 变换模式选项配置
const transformModes = [
  { value: 'translate' as const, label: '平移' },
  { value: 'rotate' as const, label: '旋转' },
] as const

// 变换空间选项配置
const transformSpaces = [
  { value: 'world' as const, label: '世界' },
  { value: 'local' as const, label: '本地' },
] as const

// 设置变换模式并触发变更
function setTransformMode(mode: 'translate' | 'rotate') {
  transformMode.value = mode
  applyTransformSelection()
}

// 设置变换空间并触发变更
function setTransformSpace(space: 'world' | 'local') {
  transformSpace.value = space
  applyTransformSelection()
}

const enableElementPicking = ref(true)

const selectedItemId = ref<string>('')
const orientationDegX = ref(0)
const orientationDegY = ref(0)
const orientationDegZ = ref(0)


const pickedElement = ref<null | {
  label: string
  ifcId?: string
  sourceLabel?: string
}>(null)

// Three.js 渲染相关实例（WebGPU）
let renderer: any = null
let scene: any = null
let camera: any = null
let gridHelper: any = null
let controls: any = null
let resizeObserver: ResizeObserver | null = null
let animationHandle = 0
let renderRequested = false
let dprCap = 1.25
let stats: any = null
let transformControls: any = null
let raycaster: any = null
let transformHelper: any = null

// 已加载资源：模型 roots（用于 UI 列表、清理、包围盒/变换控制）
const loadedObjectUrls: string[] = []
const loadedRoots: any[] = []
let contentGroup: any = null
const boundHelpers: any[] = []
const loadedItems = ref<Array<{ id: string; label: string; obj: any; fileId?: number }>>([])
let nextItemId = 1
let highlightedElement:
  | null
  | { kind: 'mesh'; mesh: any; originalMaterial: any; highlightMaterial: any }
  | { kind: 'meshOverlay'; mesh: any; overlay: any; material: any }
  | { kind: 'batched'; mesh: any; batchId: number; prevColor: any }
  | {
      kind: 'batchedOverlay'
      batched: any
      batchId: number
      overlay: any
      material: any
    } = null

// Avoid storing material object references in userData (Material.copy() JSON-stringifies userData).
const unlitMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const lambertMaterialCache = new WeakMap<any, { v0?: any; v1?: any }>()
const originalMaterialByTSL = new WeakMap<any, any>()

type ElementRef =
  | { kind: 'mesh'; mesh: any }
  | { kind: 'batched'; batched: any; batchId: number }
type BimTreePanel = {
  fileId: string
  projectId: string
  label: string
  treeData: any[]
  defaultExpandedKeys: string[]
  checkedKeys: string[]
  nodeCount: number
  expanded: boolean
  loading: boolean
  elementIndex: Map<string, ElementRef[]>
}
// elementId(GlobalId) → 场景里实际可操作的对象引用列表（mesh 或 batched instance）
const elementIndex = new Map<string, ElementRef[]>()
const bimTreePanels = ref<BimTreePanel[]>([])
const treeRefs = ref<Record<string, any>>({})
const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data: any) => !data.children || data.children.length === 0,
}

const pickedElementText = computed(() => {
  if (!pickedElement.value) return '未选择'
  const parts = [pickedElement.value.label]
  if (pickedElement.value.ifcId) parts.push(`ID: ${pickedElement.value.ifcId}`)
  if (pickedElement.value.sourceLabel)
    parts.push(`来源: ${pickedElement.value.sourceLabel}`)
  return parts.join(' | ')
})

const uploadedNamesText = computed(() => {
  if (!loadedItems.value.length) return '未上传'
  return loadedItems.value.map((item) => item.label).join('、')
})

async function loadProjectList() {
  try {
    const response = await getAllProjects()
    if (response.code === 200) {
      projectList.value = response.data.list.map((project: any) => ({
        id: project.id,
        name: project.name,
      }))
    }
  } catch (error) {
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.error('加载项目列表失败:', error)
    }
    statusText.value = '项目列表加载失败'
  }
}

async function loadExistingBimFiles(projectId: number) {
  try {
    const response = await getProjectFilesByProjectId(projectId)
    if (response.code !== 200) {
      existingBimFiles.value = []
      return
    }
    const group = response.data?.find((item) => item.type === 'bim')
    const files = (group?.files || [])
      .filter((file) => file.status === 'stored')
      .map((file) => ({
        id: String(file.id),
        label: file.originalName || `BIM-${file.id}`,
      }))
    existingBimFiles.value = files
    const idSet = new Set(files.map((file) => file.id))
    selectedExistingBimIds.value = selectedExistingBimIds.value.filter((id) => idSet.has(id))
  } catch (error) {
    existingBimFiles.value = []
    selectedExistingBimIds.value = []
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.error('加载已上传 BIM 列表失败:', error)
    }
  }
}

function isBimLoaded(id: string) {
  return loadedBimIdSet.value.has(id)
}

function toggleSelectAllBim(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  if (target.checked) {
    selectedExistingBimIds.value = [...loadableBimIds.value]
  } else {
    selectedExistingBimIds.value = []
  }
}

/** 作用：根据 `selectedItemId` 返回当前加载列表中的选中项。 */
function getSelectedItem() {
  return loadedItems.value.find((i) => i.id === selectedItemId.value) ?? null
}

/** 作用：重置实时朝向修正（X/Y/Z 欧拉角）为 0。 */
function resetOrientationFix() {
  orientationDegX.value = 0
  orientationDegY.value = 0
  orientationDegZ.value = 0
}

/** 作用：为对象建立并返回"朝向基准四元数"（用于实时旋转叠加）。 */
function ensureOrientationBase(obj: any) {
  if (!obj?.quaternion) return null
  if (!obj.userData) obj.userData = {}
  if (!obj.userData.__orientationBaseQuat)
    obj.userData.__orientationBaseQuat = obj.quaternion.clone()
  return obj.userData.__orientationBaseQuat as any
}

/** 作用：把控制面板中的朝向修正实时应用到当前选中对象上。 */
function applyOrientationFixRealtime() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.quaternion) return

  const base = ensureOrientationBase(obj)
  if (!base) return

  const offsetEuler = new THREE.Euler(
    THREE.MathUtils.degToRad(orientationDegX.value),
    THREE.MathUtils.degToRad(orientationDegY.value),
    THREE.MathUtils.degToRad(orientationDegZ.value),
    'XYZ',
  )
  const offsetQuat = new THREE.Quaternion().setFromEuler(offsetEuler)

  // q = offset * base  => base applied first, then offset.
  obj.quaternion.copy(offsetQuat).multiply(base)
  obj.updateMatrixWorld?.(true)
  transformHelper?.updateMatrixWorld?.(true)
  updateBoundsHelpers()
  requestRender()
}

/** 作用：将当前实时朝向修正"烘焙"为新的基准四元数，并清零修正量。 */
function bakeOrientationFixToSelected() {
  const item = getSelectedItem()
  const obj = item?.obj
  if (!obj?.quaternion) return

  if (!obj.userData) obj.userData = {}
  obj.userData.__orientationBaseQuat = obj.quaternion.clone()
  resetOrientationFix()
  applyOrientationFixRealtime()
}

/** 作用：递归释放对象树中的几何体/材质/贴图，避免内存泄漏。 */
function disposeObject(root: any) {
  ;(root as any).traverse((obj: any) => {
    const mesh = obj as any
    if (mesh?.isMesh) {
      mesh.geometry?.dispose?.()
      const material = mesh.material as any
      if (Array.isArray(material)) material.forEach((m) => disposeMaterial(m))
      else if (material) disposeMaterial(material)
    }
  })
}

/** 作用：释放材质中引用的贴图资源，并 dispose 材质本身。 */
function disposeMaterial(material: any) {
  const maybeAny = material as Record<string, unknown>
  for (const value of Object.values(maybeAny)) {
    const texture = value as any
    if (texture?.isTexture) texture.dispose?.()
  }
  material.dispose?.()
}

/** 作用：从 mesh.userData 中尽力推断 ifcId/GlobalId 等标识字段。 */
function guessIfcId(userData: any): string | undefined {
  if (!userData || typeof userData !== 'object') return undefined

  const directKeys = [
    'expressID',
    'ExpressID',
    'expressId',
    'ifcId',
    'ifcID',
    'IfcId',
    'globalId',
    'GlobalId',
    'guid',
    'GUID',
    'IfcGUID',
    'ifcGuid',
  ]

  for (const k of directKeys) {
    const v = (userData as any)[k]
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (s) return s
  }

  // common nesting patterns
  const nested =
    (userData as any).properties ??
    (userData as any).PropertySets ??
    (userData as any).ifc ??
    null
  if (nested && typeof nested === 'object') {
    for (const k of directKeys) {
      const v = (nested as any)[k]
      if (v === null || v === undefined) continue
      const s = String(v).trim()
      if (s) return s
    }
  }

  return undefined
}

/** 作用：判断字符串是否符合 IFC GlobalId 的 22 位压缩格式。 */
function looksLikeIfcGuid(s: unknown) {
  const str = String(s ?? '').trim()
  return /^[0-9A-Za-z_$]{22}$/.test(str)
}

/** 作用：从导出器名称中抽取可能的构件 id（含“_1”这类子件后缀）。 */
function candidateIdsFromName(name: unknown) {
  const s = String(name ?? '').trim()
  if (!s) return []
  const out = [s]
  // Some exporters append suffixes for sub-parts, e.g. "1501_1".
  if (s.includes('_')) {
    const base = (s.split('_')[0] ?? '').trim()
    if (base && base !== s) out.push(base)
  }
  return out
}



/** 作用：从命中的 3D 对象（含祖先）推断出 elementId(GlobalId)，用于点选/显隐联动。 */
function getElementIdFromObject(obj: any): string | undefined {
  // Prefer IFC GUIDs on nodes (IfcConvert --use-element-guids typically writes them to node.name).
  let cur: any = obj
  while (cur) {
    const name = String(cur?.name ?? '').trim()
    for (const candidate of candidateIdsFromName(name)) {
      if (looksLikeIfcGuid(candidate)) return candidate
    }
    const byUserData = guessIfcId(cur?.userData)
    if (byUserData) return byUserData
    cur = cur.parent
  }
  return undefined
}

/** 作用：清空 elementId → 场景对象引用 的索引。 */
function clearElementIndex() {
  elementIndex.clear()
}

// /** 作用：向 elementIndex 追加一个 elementId 对应的场景引用（mesh 或 batched instance）。 */
// function indexElement(id: string, ref: ElementRef) {
//   const key = normalizeMetaKey(id)
//   if (!key) return
//   const existing = elementIndex.get(key)
//   if (existing) existing.push(ref)
//   else elementIndex.set(key, [ref])
// }


/** 作用：扫描已加载的 GLB 场景，重建 elementId(GlobalId) → 场景对象引用 的索引。 */
function rebuildElementIndex() {
  // 构建 elementId(GlobalId) → 场景对象引用 的索引。
  // 这是高亮功能能工作的关键。
  clearElementIndex()
  for (const root of loadedRoots) {
    root?.traverse?.((obj: any) => {
      if (!obj || obj?.userData?.__viewerPickIgnore) return
      if (obj?.isBatchedMesh) {
        // BatchedMesh：raycast 返回 batchId（instanceId），可对单个 instance 做显隐/高亮。
        const arr: any[] = obj?.userData?.__viewerBatchMeta
        if (!Array.isArray(arr)) return
        for (let i = 0; i < arr.length; i++) {
          const meta = arr[i]
          const elementId = meta?.elementId ?? meta?.ifcId ?? meta?.label
          if (!elementId) continue
          indexElement(elementIndex, elementId, { kind: 'batched', batched: obj, batchId: i })
        }
        return
      }
      if (obj?.isMesh) {
        // 普通 Mesh：尽量从 name / userData / 父节点推断 elementId
        const elementId = getElementIdFromObject(obj)
        if (!elementId) return
        indexElement(elementIndex, elementId, { kind: 'mesh', mesh: obj })
      }
    })
  }
}

/** 作用：从 elementIndex 获取某个 elementId 对应的所有场景引用（mesh/batched）。 */
// function getElementRefsById(id: unknown) {
//   const key = normalizeMetaKey(id)
//   if (!key) return []
//   return elementIndex.get(key) ?? []
// }

/** 作用：把 userData 中常见的标识字段/嵌套结构做摘要，便于 Debug logs 输出。 */
function debugUserDataSummary(userData: any) {
  if (!userData || typeof userData !== 'object')
    return { type: typeof userData }

  const directKeys = [
    'expressID',
    'ExpressID',
    'expressId',
    'ifcId',
    'ifcID',
    'IfcId',
    'globalId',
    'GlobalId',
    'guid',
    'GUID',
    'IfcGUID',
    'ifcGuid',
    'name',
    'label',
    'type',
  ]

  const direct: Record<string, unknown> = {}
  for (const k of directKeys) {
    const v = (userData as any)[k]
    if (v !== undefined) direct[k] = v
  }

  const nested =
    (userData as any).properties ??
    (userData as any).PropertySets ??
    (userData as any).ifc ??
    null
  const nestedDirect: Record<string, unknown> = {}
  if (nested && typeof nested === 'object') {
    for (const k of directKeys) {
      const v = (nested as any)[k]
      if (v !== undefined) nestedDirect[k] = v
    }
  }

  return {
    keys: Object.keys(userData).slice(0, 30),
    guessedId: guessIfcId(userData),
    direct,
    nestedKeys:
      nested && typeof nested === 'object'
        ? Object.keys(nested).slice(0, 30)
        : undefined,
    nestedDirect: Object.keys(nestedDirect).length ? nestedDirect : undefined,
  }
}

/** 作用：将相机与轨道控制器聚焦到给定包围盒（用于“定位/聚焦选中”）。 */
function focusBox(box: any) {
  if (!camera || !controls) return
  if (!box || !box.getSize || !box.getCenter) return

  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  const dir = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize()
  if (!Number.isFinite(dir.lengthSq()) || dir.lengthSq() === 0)
    dir.set(0, 0.2, 1).normalize()

  controls.target.copy(center)
  camera.position.copy(center).addScaledVector(dir, distance * 2.2)
  camera.near = distance / 100
  camera.far = distance * 200
  camera.updateProjectionMatrix()
  controls.update()
  requestRender()
}

/** 作用：计算一个 element 引用（mesh 或 batched instance）的世界空间包围盒。 */
function computeBoxForElementRef(ref: ElementRef) {
  if (ref.kind === 'mesh') {
    const box = new THREE.Box3().setFromObject(ref.mesh)
    if (!box.isEmpty()) return box
    return null
  }

  const batched = ref.batched
  const batchId = ref.batchId
  try {
    const instanceInfo = batched?._instanceInfo?.[batchId]
    const geometryId = instanceInfo?.geometryIndex
    if (geometryId === undefined) return null
    const localBox = new THREE.Box3()
    batched.getBoundingBoxAt?.(geometryId, localBox)
    if (localBox.isEmpty()) return null
    const world = new THREE.Matrix4()
    batched.getMatrixAt?.(batchId, world)
    world.premultiply(batched.matrixWorld)
    localBox.applyMatrix4(world)
    return localBox
  } catch {
    return null
  }
}

/** 作用：将某个 elementId 对应的所有场景引用整体设为可见/不可见。 */
// function setElementVisibleIn3D(elementId: string, visible: boolean) {
//   const refs = getElementRefsById(elementId)
//   for (const r of refs) {
//     if (r.kind === 'mesh') r.mesh.visible = visible
//     else r.batched.setVisibleAt?.(r.batchId, visible)
//   }
//   requestRender()
// }

/** 作用：更新 hiddenElementIds 集合，并同步该 elementId 在 3D 中的显隐。 */
// function setElementHidden(elementId: string, hidden: boolean) {
//   const id = normalizeMetaKey(elementId)
//   if (!id) return
//   const refs = getElementRefsById(id)
//   for (const r of refs) {
//     if (r.kind === 'mesh') r.mesh.visible = !hidden
//     else r.batched.setVisibleAt?.(r.batchId, !hidden)
//   }
//   requestRender()
// }

/** 作用：恢复上一次高亮（撤销 overlay 或还原材质/颜色）。 */
function restoreHighlightedElement() {
  if (!highlightedElement) return

  if (highlightedElement.kind === 'batched') {
    highlightedElement.mesh.setColorAt?.(
      highlightedElement.batchId,
      highlightedElement.prevColor,
    )
  } else if (highlightedElement.kind === 'batchedOverlay') {
    scene?.remove?.(highlightedElement.overlay)
    disposeMaterial(highlightedElement.material)
  } else if (highlightedElement.kind === 'meshOverlay') {
    highlightedElement.mesh.remove?.(highlightedElement.overlay)
    disposeMaterial(highlightedElement.material)
  } else {
    highlightedElement.mesh.material = highlightedElement.originalMaterial
    const hm = highlightedElement.highlightMaterial
    if (Array.isArray(hm)) hm.forEach((m) => disposeMaterial(m))
    else if (hm) disposeMaterial(hm)
  }

  highlightedElement = null
}

/** 作用：清空当前点选（同时撤销高亮）。 */
function clearPickedElement() {
  restoreHighlightedElement()
  pickedElement.value = null
  requestRender()
}

/** 作用：对普通 Mesh 以 overlay 方式做高亮（避免材质 clone/循环引用问题）。 */
function highlightMesh(mesh: any, color: any) {
  if (!mesh?.isMesh) return

  const mat = createHighlightOverlayMaterial(color)
  const overlay = new THREE.Mesh(mesh.geometry, mat)
  overlay.name = 'Pick Highlight Overlay'
  overlay.userData = overlay.userData ?? {}
  overlay.userData.__viewerPickIgnore = true
  overlay.frustumCulled = false
  overlay.matrixAutoUpdate = false
  overlay.renderOrder = 9998
  overlay.matrix.identity()
  overlay.matrixWorldNeedsUpdate = true
  mesh.add(overlay)
  highlightedElement = { kind: 'meshOverlay', mesh, overlay, material: mat }
}

/** 作用：创建用于高亮 overlay 的材质（TSL 模式下确保可见）。 */
function createHighlightOverlayMaterial(color: any) {
  const mat: any =
    materialMode.value === 'lambert'
      ? new MeshLambertNodeMaterial()
      : new MeshBasicNodeMaterial()
  mat.name = 'Pick Highlight'
  mat.transparent = true
  mat.opacity = 0.65
  mat.depthTest = false
  mat.depthWrite = false
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -1
  mat.toneMapped = false

  if ('colorNode' in mat) {
    mat.colorNode = tslColor(color)
    mat.vertexColors = false
    mat.needsUpdate = true
  } else if (mat.color) {
    mat.color.copy?.(color)
  }

  return mat
}

/** 作用：同步 batched overlay 的矩阵到对应 instance 的世界变换。 */
function updateHighlightedOverlayTransform() {
  if (!highlightedElement || highlightedElement.kind !== 'batchedOverlay')
    return
  const batched = highlightedElement.batched
  const batchId = highlightedElement.batchId
  const overlay = highlightedElement.overlay

  const world = new THREE.Matrix4()
  batched.getMatrixAt?.(batchId, world)
  world.premultiply(batched.matrixWorld)
  overlay.matrix.copy(world)
  overlay.matrixWorld.copy(world)
  overlay.matrixWorldNeedsUpdate = false
}

/** 作用：对 BatchedMesh 的单个 instance 做高亮（TSL 用 overlay，original 用 per-instance tint）。 */
function highlightBatched(mesh: any, batchId: number, color: any) {
  if (!mesh?.isBatchedMesh) return

  // WebGPU + NodeMaterial does not reliably show BatchedMesh per-instance colors across all modes.
  // Use an overlay mesh in TSL modes, keep the lightweight per-instance tint for "original".
  if (materialMode.value !== 'original') {
    const instanceInfo = mesh?._instanceInfo?.[batchId]
    const geometryId = instanceInfo?.geometryIndex
    const geometryInfo =
      geometryId !== undefined ? mesh?._geometryInfo?.[geometryId] : null
    if (!geometryInfo) return

    const overlayGeom = new THREE.BufferGeometry()
    overlayGeom.index = mesh.geometry.index
    overlayGeom.attributes = mesh.geometry.attributes
    overlayGeom.setDrawRange(
      geometryInfo.start ?? 0,
      geometryInfo.count ?? Infinity,
    )

    const mat = createHighlightOverlayMaterial(color)
    const overlay = new THREE.Mesh(overlayGeom, mat)
    overlay.userData = overlay.userData ?? {}
    overlay.userData.__viewerPickIgnore = true
    overlay.frustumCulled = false
    overlay.matrixAutoUpdate = false
    overlay.renderOrder = 9998

    highlightedElement = {
      kind: 'batchedOverlay',
      batched: mesh,
      batchId,
      overlay,
      material: mat,
    }
    updateHighlightedOverlayTransform()
    scene?.add?.(overlay)
    return
  }

  const prev = new THREE.Color(1, 1, 1)
  // BatchedMesh lazily creates _colorsTexture on first setColorAt. If it doesn't exist yet,
  // the "previous" color is effectively white.
  if (mesh._colorsTexture !== null && typeof mesh.getColorAt === 'function') {
    mesh.getColorAt(batchId, prev)
  }
  mesh.setColorAt?.(batchId, color)
  highlightedElement = { kind: 'batched', mesh, batchId, prevColor: prev }
}

/** 作用：更新“是否已加载模型”的派生标记。 */
function updateLoadedFlags() {
  hasModel.value = (contentGroup?.children?.length ?? 0) > 0
}

/** 作用：根据当前 loadedRoots 重新生成左侧“已加载列表”。 */
function rebuildLoadedItems() {
  const items: Array<{
    id: string
    label: string
    obj: any
    fileId?: number
  }> = []

  for (const root of loadedRoots) {
    const id = root?.userData?.__viewerItemId
    const label = root?.userData?.__viewerLabel ?? `glTF ${id ?? ''}`.trim()
    const fileId = root?.userData?.__viewerFileId
    if (id) items.push({ id: String(id), label, obj: root, fileId })
  }

  loadedItems.value = items

  if (!items.some((i) => i.id === selectedItemId.value)) {
    selectedItemId.value = items[0]?.id ?? ''
  }
  resetOrientationFix()
  const item = items.find((i) => i.id === selectedItemId.value)
  if (item?.obj?.quaternion) {
    if (!item.obj.userData) item.obj.userData = {}
    item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
  }
}

function setTreeRef(fileId: string, el: any) {
  if (el) treeRefs.value[fileId] = el
  else delete treeRefs.value[fileId]
}

function toggleTreeGroup(fileId: string) {
  const panel = bimTreePanels.value.find((p) => p.fileId === fileId)
  if (panel) panel.expanded = !panel.expanded
}

function countTreeNodes(nodes: any[]): number {
  let count = 0
  const stack = [...nodes]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    count++
    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child)
    }
  }
  return count
}

function getDefaultExpandedKeys(nodes: any[], maxDepth: number, depth = 0): string[] {
  if (depth >= maxDepth) return []
  const keys: string[] = []
  for (const node of nodes) {
    if (node?.id) keys.push(node.id)
    if (Array.isArray(node?.children) && node.children.length > 0) {
      keys.push(...getDefaultExpandedKeys(node.children, maxDepth, depth + 1))
    }
  }
  return keys
}

function getAllNodeKeys(nodes: any[]): string[] {
  const keys: string[] = []
  const stack = [...nodes]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    if (node.id) keys.push(node.id)
    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child)
    }
  }
  return keys
}

function buildTreeNodes(treeNode: any, elements: Record<string, any>): any[] {
  if (!treeNode || !Array.isArray(treeNode.children)) return []
  const result: any[] = []
  for (const child of treeNode.children) {
    const elementId = child.id
    const element = elements?.[elementId]
    result.push({
      id: elementId,
      label: child.name || element?.name || child.type || elementId,
      type: child.type || element?.type || '',
      stepId: element?.stepId,
      children: buildTreeNodes(child, elements),
    })
  }
  return result
}

function indexElement(map: Map<string, ElementRef[]>, id: unknown, ref: ElementRef) {
  const key = String(id ?? '').trim()
  if (!key) return
  const list = map.get(key)
  if (list) list.push(ref)
  else map.set(key, [ref])
}

function buildElementIndexForRoot(root: any) {
  const map = new Map<string, ElementRef[]>()
  root?.traverse?.((obj: any) => {
    if (!obj || obj?.userData?.__viewerPickIgnore) return
    if (obj?.isBatchedMesh) {
      const arr: any[] = obj?.userData?.__viewerBatchMeta
      if (!Array.isArray(arr)) return
      for (let i = 0; i < arr.length; i++) {
        const meta = arr[i]
        const elementId = meta?.elementId ?? meta?.ifcId ?? meta?.label
        if (!elementId) continue
        indexElement(map, elementId, { kind: 'batched', batched: obj, batchId: i })
      }
      return
    }
    if (obj?.isMesh) {
      const elementId = getElementIdFromObject(obj)
      if (!elementId) return
      indexElement(map, elementId, { kind: 'mesh', mesh: obj })
    }
  })
  return map
}

function applyModelVisibility(panel: BimTreePanel, checkedKeys: string[], halfCheckedKeys: string[]) {
  const visibleSet = new Set<string>([...checkedKeys, ...halfCheckedKeys].map((k) => String(k)))
  for (const [elementId, refs] of panel.elementIndex.entries()) {
    const visible = visibleSet.has(elementId)
    for (const ref of refs) {
      if (ref.kind === 'mesh') {
        ref.mesh.visible = visible
      } else if (ref.batched?.setVisibleAt) {
        ref.batched.setVisibleAt(ref.batchId, visible)
      }
    }
  }
  requestRender()
}

function setTreeAll(fileId: string, checked: boolean) {
  const panel = bimTreePanels.value.find((p) => p.fileId === fileId)
  if (!panel) return
  const keys = checked ? getAllNodeKeys(panel.treeData) : []
  panel.checkedKeys = keys
  const tree = treeRefs.value[fileId]
  tree?.setCheckedKeys?.(keys)
  applyModelVisibility(panel, keys, [])
}

function handleTreeCheck(fileId: string, info: any) {
  const panel = bimTreePanels.value.find((p) => p.fileId === fileId)
  if (!panel) return
  const checkedKeys = info?.checkedKeys ?? []
  const halfCheckedKeys = info?.halfCheckedKeys ?? []
  panel.checkedKeys = checkedKeys
  applyModelVisibility(panel, checkedKeys, halfCheckedKeys)
}

function handleTreeNodeClick(fileId: string, data: any) {
  const panel = bimTreePanels.value.find((p) => p.fileId === fileId)
  if (!panel) return
  const elementId = String(data?.id ?? '').trim()
  if (!elementId) return
  const refs = panel.elementIndex.get(elementId)
  if (!refs || refs.length === 0) return
  clearPickedElement()
  const ref = refs[0]
  const color = new THREE.Color('#409eff')
  if (ref.kind === 'batched') {
    highlightBatched(ref.batched, ref.batchId, color)
  } else {
    highlightMesh(ref.mesh, color)
  }
  pickedElement.value = {
    label: data?.label || '构件',
    ifcId: elementId,
  }
  requestRender()
}

function upsertBimTreePanel(panel: BimTreePanel) {
  const idx = bimTreePanels.value.findIndex((p) => p.fileId === panel.fileId)
  if (idx >= 0) {
    bimTreePanels.value[idx] = panel
    return idx
  }
  bimTreePanels.value.push(panel)
  return bimTreePanels.value.length - 1
}

async function loadBimTreeForRoot(root: any) {
  const fileId = root?.userData?.__viewerFileId
  const projectId = root?.userData?.__viewerProjectId
  if (!fileId || !projectId) return

  const label = root?.userData?.__viewerLabel ?? `BIM-${fileId}`
  const index = buildElementIndexForRoot(root)
  const basePanel: BimTreePanel = {
    fileId: String(fileId),
    projectId: String(projectId),
    label,
    treeData: [],
    defaultExpandedKeys: [],
    checkedKeys: [],
    nodeCount: 0,
    expanded: true,
    loading: true,
    elementIndex: index,
  }

  upsertBimTreePanel(basePanel)

  try {
    const data: any = await getIfcMetadata(Number(projectId), Number(fileId))
    if (!data?.tree || !data?.elements) {
      throw new Error('empty metadata')
    }

    const treeData = buildTreeNodes(data.tree, data.elements)
    const allKeys = getAllNodeKeys(treeData)
    const panel: BimTreePanel = {
      ...basePanel,
      treeData,
      defaultExpandedKeys: getDefaultExpandedKeys(treeData, 2),
      checkedKeys: allKeys,
      nodeCount: countTreeNodes(treeData),
      loading: false,
      elementIndex: index,
    }

    upsertBimTreePanel(panel)

    await nextTick()
    const tree = treeRefs.value[panel.fileId]
    tree?.setCheckedKeys?.(allKeys)
    applyModelVisibility(panel, allKeys, [])
  } catch (error) {
    const fallback: BimTreePanel = {
      ...basePanel,
      treeData: [],
      defaultExpandedKeys: [],
      checkedKeys: [],
      nodeCount: 0,
      loading: false,
    }
    upsertBimTreePanel(fallback)
  }
}

/** 作用：根据 editMode/selectedItemId 将 TransformControls 绑定或解绑到当前对象。 */
function applyTransformSelection() {
  if (!transformControls) return

  if (!editMode.value || !selectedItemId.value) {
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    requestRender()
    return
  }

  const item = loadedItems.value.find((i) => i.id === selectedItemId.value)
  if (!item) {
    transformControls.detach()
    if (transformHelper) transformHelper.visible = false
    requestRender()
    return
  }

  // Ensure we can render and manipulate the transform gizmo reliably.
  item.obj.matrixAutoUpdate = true
  item.obj.updateMatrixWorld?.(true)

  transformControls.setSpace?.(transformSpace.value)
  transformControls.setMode(transformMode.value)
  transformControls.showX = true
  transformControls.showY = true
  transformControls.showZ = true

  transformControls.attach(item.obj)
  if (transformHelper) transformHelper.visible = true
  transformHelper?.updateMatrixWorld?.(true)
  resetOrientationFix()
  ensureOrientationBase(item.obj)
  if (enableDebugLogs.value) {
    const worldPos = new THREE.Vector3()
    item.obj.getWorldPosition?.(worldPos)
    // eslint-disable-next-line no-console
    console.log('[Edit] attach', {
      mode: transformMode.value,
      selectedItemId: selectedItemId.value,
      label: item.label,
      attached: !!transformControls.object,
      objectType: transformControls.object?.type,
      objectPos: transformControls.object?.position?.toArray?.(),
      objectWorldPos: worldPos.toArray(),
      matrixAutoUpdate: item.obj.matrixAutoUpdate,
    })
  }
  requestRender()
}

/** 作用：移除并释放所有包围盒辅助线。 */
function clearBoundsHelpers() {
  if (!scene) return
  for (const h of boundHelpers) {
    scene.remove(h)
    h.geometry?.dispose?.()
    h.material?.dispose?.()
  }
  boundHelpers.length = 0
}

/** 作用：根据开关为当前加载的 root 更新包围盒辅助线显示。 */
function updateBoundsHelpers() {
  if (!scene || !contentGroup) return
  clearBoundsHelpers()
  if (!showBounds.value) return

  const color = new THREE.Color('#ffcf4a')
  const tmpBox = new THREE.Box3()
  const addHelperFor = (obj: any) => {
    tmpBox.setFromObject(obj)
    if (tmpBox.isEmpty()) return
    const helper = new THREE.Box3Helper(tmpBox.clone(), color)
    helper.renderOrder = 9999
    ;(helper.material as any).depthTest = false
    boundHelpers.push(helper)
    scene.add(helper)
  }

  for (const root of loadedRoots) addHelperFor(root)
  requestRender()
}

/** 作用：清空当前场景中的所有加载内容、索引与交互状态（不销毁 renderer/camera）。 */
function clearScene() {
  if (!scene || !contentGroup) return

  clearPickedElement()
  restoreHighlightedElement()
  clearElementIndex()
  clearBoundsHelpers()
  transformControls?.detach?.()
  if (transformHelper) transformHelper.visible = false

  for (const root of loadedRoots) {
    contentGroup.remove(root)
    disposeObject(root)
  }
  loadedRoots.length = 0

  for (const url of loadedObjectUrls) URL.revokeObjectURL(url)
  loadedObjectUrls.length = 0
  bimTreePanels.value = []
  treeRefs.value = {}

  updateLoadedFlags()
  rebuildLoadedItems()
  requestRender()
}

/** 作用：将对象整体平移到原点，并根据其包围盒重新设置相机/控制器视角。 */
function fitCameraToObject(object: any) {
  if (!camera || !controls) return

  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  object.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = maxDim / 2 / Math.tan(fov / 2)

  controls.target.set(0, 0, 0)
  camera.position.set(0, maxDim * 0.15, distance * 2.2)
  camera.near = distance / 100
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  controls.update()
}

/** 作用：在 Debug logs 模式下输出模型统计信息（mesh/triangles/bytes 等）。 */
function logModelStats(root: any, extra?: Record<string, unknown>) {
  if (!enableDebugLogs.value) return

  let meshCount = 0
  let batchedMeshCount = 0
  let postBatchTransparentMeshCount = 0
  let alphaTestedMeshCount = 0
  let sumBatchedInstances = 0
  let sumBatchedGeometries = 0
  let vertexCount = 0
  let triangleCount = 0
  const materialUuids = new Set<string>()
  const geometryUuids = new Set<string>()
  let textureCount = 0

  const textures = new Set<any>()
  root.traverse((obj: any) => {
    if (obj?.isBatchedMesh) {
      batchedMeshCount++
      sumBatchedInstances += obj.instanceCount ?? 0
      sumBatchedGeometries += (obj._geometryCount ?? 0) as number
    }
    if (obj?.isMesh) {
      meshCount++
      if (obj.material?.transparent) postBatchTransparentMeshCount++
      if ((obj.material?.alphaTest ?? 0) > 0) alphaTestedMeshCount++
      if (obj.geometry?.uuid) geometryUuids.add(obj.geometry.uuid)
      const pos = obj.geometry?.attributes?.position
      if (pos?.count) vertexCount += pos.count
      const idx = obj.geometry?.index
      if (idx?.count) triangleCount += Math.floor(idx.count / 3)
      else if (pos?.count) triangleCount += Math.floor(pos.count / 3)

      const mat = obj.material
      if (mat && !Array.isArray(mat) && mat.uuid) {
        materialUuids.add(mat.uuid)
        for (const v of Object.values(mat)) {
          if (v && typeof v === 'object' && 'isTexture' in (v as any))
            textures.add(v)
        }
      }
    }
  })
  textureCount = textures.size

  const info = renderer?.info?.render
  // eslint-disable-next-line no-console
  console.log('[Viewer] model stats', {
    meshCount,
    batchedMeshCount,
    postBatchTransparentMeshCount,
    alphaTestedMeshCount,
    sumBatchedInstances,
    sumBatchedGeometries,
    uniqueGeometries: geometryUuids.size,
    uniqueMaterials: materialUuids.size,
    textureCount,
    approxVertices: vertexCount,
    approxTriangles: triangleCount,
    renderInfo: info
      ? { calls: info.calls, triangles: info.triangles }
      : undefined,
    ...extra,
  })
}

/** 作用：判断一个 Mesh 是否适合参与 BatchedMesh 合批（排除蒙皮/实例化/形变等）。 */
function isOptimizableMesh(mesh: any) {
  if (!mesh?.isMesh) return false
  if (mesh?.isSkinnedMesh) return false
  if (mesh?.isInstancedMesh) return false
  if (!mesh?.geometry?.isBufferGeometry) return false
  if (!mesh?.geometry?.attributes?.position) return false
  if (Array.isArray(mesh.material)) return false
  if (
    mesh.geometry?.morphAttributes &&
    Object.keys(mesh.geometry.morphAttributes).length > 0
  )
    return false
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0)
    return false
  if (mesh.skeleton) return false
  return true
}

/** 作用：生成几何体“属性布局签名”，用于合批时分组（避免不兼容布局混合）。 */
function geometrySignature(geometry: any) {
  const index = geometry.index
    ? `i:${geometry.index.array?.constructor?.name ?? 'idx'}`
    : 'i:none'
  const attrs = Object.keys(geometry.attributes ?? {})
    .sort()
    .map((name) => {
      const a = geometry.attributes[name]
      return `${name}:${a?.itemSize ?? 0}:${a?.normalized ? 1 : 0}:${a?.array?.constructor?.name ?? 'arr'}:${a?.gpuType ?? ''}`
    })
    .join('|')
  return `${index}|${attrs}`
}

/** 作用：翻转几何体绕序并反转法线（用于修复镜像缩放导致的背面/光照问题）。 */
function flipWindingAndNormals(geometry: any) {
  const index = geometry.getIndex?.()
  if (index?.array) {
    const arr = index.array
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1]
      arr[i + 1] = arr[i + 2]
      arr[i + 2] = tmp
    }
    index.needsUpdate = true
  }

  const normal = geometry.attributes?.normal
  if (normal?.array) {
    const na = normal.array
    for (let i = 0; i < na.length; i++) na[i] = -na[i]
    normal.needsUpdate = true
  }
}

/** 作用：返回数值的符号（仅 -1 或 1）。 */
function sign(v: number) {
  return v < 0 ? -1 : 1
}

/** 作用：把原材质上影响透明/双面的通用标志同步到替换材质上。 */
function applySharedMaterialFlags(mat: any, src: any) {
  const alphaTest = src?.alphaTest ?? 0
  const opacity = src?.opacity ?? 1
  mat.alphaTest = alphaTest
  mat.opacity = opacity
  mat.transparent = alphaTest > 0 ? false : !!src?.transparent || opacity < 1
  mat.side = src?.side ?? THREE.FrontSide
}

/** 作用：获取或创建与源材质对应的 TSL Unlit 材质（按 vertexColors 分缓存）。 */
function getOrCreateUnlitTSLMaterial(
  src: any,
  opts: { vertexColors: boolean },
) {
  const entry = unlitMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new NodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Unlit)` : 'TSL Unlit'
  mat.fog = false
  mat.lights = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = false

  mat.colorNode = opts.vertexColors
    ? tslVertexColor()
    : tslColor(src?.color ?? 0xffffff)
  mat.vertexColors = opts.vertexColors

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  unlitMaterialCache.set(src, entry)

  return mat
}

/** 作用：获取或创建与源材质对应的 TSL Lambert 材质（按 vertexColors 分缓存）。 */
function getOrCreateLambertTSLMaterial(
  src: any,
  opts: { vertexColors: boolean },
) {
  const entry = lambertMaterialCache.get(src) ?? {}
  const cached = opts.vertexColors ? entry.v1 : entry.v0
  if (cached) return cached

  const mat = new MeshLambertNodeMaterial()
  mat.name = src?.name ? `${src.name} (TSL Lambert)` : 'TSL Lambert'
  mat.fog = false

  applySharedMaterialFlags(mat, src)
  mat.toneMapped = true

  mat.color = src?.color ? src.color.clone() : new THREE.Color(0xffffff)
  mat.vertexColors = opts.vertexColors

  originalMaterialByTSL.set(mat, src)
  ;(mat as any).__viewerOriginalMaterial = src
  if (opts.vertexColors) entry.v1 = mat
  else entry.v0 = mat
  lambertMaterialCache.set(src, entry)

  return mat
}

/** 作用：在整个 root 上切换材质模式（original / unlit / lambert），并返回替换数量。 */
function applyMaterialMode(root: any, mode: 'original' | 'unlit' | 'lambert') {
  let changed = 0

  root.traverse((obj: any) => {
    if (!obj?.material) return
    if (Array.isArray(obj.material)) return

    if (mode === 'original') {
      const original =
        (obj.material as any)?.__viewerOriginalMaterial ??
        originalMaterialByTSL.get(obj.material) ??
        obj.material.userData?.__originalMaterial
      if (original && obj.material !== original) {
        obj.material = original
        changed++
      }
      return
    }

    const src =
      (obj.material as any)?.__viewerOriginalMaterial ??
      originalMaterialByTSL.get(obj.material) ??
      obj.material.userData?.__originalMaterial ??
      obj.material
    const opts = { vertexColors: !!obj.geometry?.attributes?.color }
    const next =
      mode === 'lambert'
        ? getOrCreateLambertTSLMaterial(src, opts)
        : getOrCreateUnlitTSLMaterial(src, opts)

    if (obj.material !== next) {
      obj.material = next
      changed++
    }
  })

  return changed
}

/** 作用：对 glTF root 做合批优化，并在 BatchedMesh 上保留 elementId 元数据用于点选/显隐。 */
function optimizeRoot(root: any) {
  /**
   * 作用：对 GLB 做一次“同材质 + 同属性布局”的 Mesh 合批（降低 drawcall，提高交互性能）。
   *
   * 为什么：
   * - IFC → GLB 通常会产生大量构件 mesh，drawcall 很多
   * - WebGPU 在大量 drawcall 下也会吃紧
   *
   * 怎么做：
   * - 遍历 root 下的 Mesh，按 `material.uuid + geometrySignature` 分组
   * - 对每组构建 `THREE.BatchedMesh`，把每个原始 mesh 作为一个 instance
   * - 在 `batched.userData.__viewerBatchMeta[instanceId]` 里保存 elementId/label/ifcId
   *
   * 注意：
   * - 合批后“构件级”操作（显隐/高亮）必须走 batchId(instanceId)
   * - 多材质 mesh、蒙皮、morph 等复杂网格会跳过
   */
  root.updateMatrixWorld(true)
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert()

  const candidates: any[] = []
  let skippedMultiMaterial = 0
  let preBatchTransparentMeshCount = 0
  let skippedOther = 0
  root.traverse((obj: any) => {
    if (!obj?.isMesh) return
    if (Array.isArray(obj.material)) {
      skippedMultiMaterial++
      return
    }
    if (obj.material?.transparent) preBatchTransparentMeshCount++
    if (isOptimizableMesh(obj)) candidates.push(obj)
    else skippedOther++
  })

  const removed = new Set<any>()

  // BatchedMesh: same material reference + compatible attributes
  const batchGroups = new Map<string, any[]>()
  for (const mesh of candidates) {
    if (removed.has(mesh)) continue
    const material = mesh.material
    const geometry = mesh.geometry
    const key = `${material.uuid}|${geometrySignature(geometry)}`
    const list = batchGroups.get(key)
    if (list) list.push(mesh)
    else batchGroups.set(key, [mesh])
  }

  let batchedCount = 0
  let totalBatchedInstances = 0
  for (const meshes of batchGroups.values()) {
    if (meshes.length < 2) continue

    const material = meshes[0].material
    const geometriesByKey = new Map<
      string,
      { geometry: any; meshes: any[]; signKey: string }
    >()
    const tmpMat = new THREE.Matrix4()
    const tmpPos = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3()
    for (const mesh of meshes) {
      tmpMat.multiplyMatrices(rootInverse, mesh.matrixWorld)
      tmpMat.decompose(tmpPos, tmpQuat, tmpScale)
      const sx = sign(tmpScale.x)
      const sy = sign(tmpScale.y)
      const sz = sign(tmpScale.z)
      const signKey = `${sx},${sy},${sz}`
      const key = `${mesh.geometry.uuid}|${signKey}`
      const existing = geometriesByKey.get(key)
      if (existing) existing.meshes.push(mesh)
      else
        geometriesByKey.set(key, {
          geometry: mesh.geometry,
          meshes: [mesh],
          signKey,
        })
    }

    let maxVertexCount = 0
    let maxIndexCount = 0
    const hasIndex = meshes[0].geometry.getIndex?.() !== null
    for (const { geometry } of geometriesByKey.values()) {
      maxVertexCount += geometry.getAttribute('position').count
      if (hasIndex) maxIndexCount += geometry.getIndex().count
    }

    const batched = new THREE.BatchedMesh(
      meshes.length,
      maxVertexCount,
      maxIndexCount,
      material,
    )
    batched.frustumCulled = true
    batched.perObjectFrustumCulled = true
    const alphaTest = material.alphaTest ?? 0
    const opacity = material.opacity ?? 1
    batched.sortObjects =
      !!material.transparent && alphaTest === 0 && opacity < 1
    batched.castShadow = meshes.some((m) => !!m.castShadow)
    batched.receiveShadow = meshes.some((m) => !!m.receiveShadow)
    batched.matrixAutoUpdate = false
    batched.userData = batched.userData ?? {}
    batched.userData.__viewerBatchMeta = []

    const geomIdByKey = new Map<string, number>()
    const local = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const absScale = new THREE.Vector3()
    for (const [key, group] of geometriesByKey.entries()) {
      const [sxStr, syStr, szStr] = group.signKey.split(',')
      const sx = Number(sxStr)
      const sy = Number(syStr)
      const sz = Number(szStr)

      let geometryForBatch = group.geometry
      let shouldDispose = false
      if (!(sx === 1 && sy === 1 && sz === 1)) {
        const baked = group.geometry.clone()
        baked.scale(sx, sy, sz)
        if (sx * sy * sz < 0) flipWindingAndNormals(baked)
        geometryForBatch = baked
        shouldDispose = true
      }

      const geometryId = batched.addGeometry(geometryForBatch)
      geomIdByKey.set(key, geometryId)
      if (shouldDispose) geometryForBatch.dispose?.()
    }

    for (const [key, group] of geometriesByKey.entries()) {
      const geometryId = geomIdByKey.get(key)!
      for (const mesh of group.meshes) {
        local.multiplyMatrices(rootInverse, mesh.matrixWorld)
        local.decompose(pos, quat, scale)
        absScale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
        local.compose(pos, quat, absScale)
        const instanceId = batched.addInstance(geometryId)
        batched.setMatrixAt(instanceId, local)
        const elementId = getElementIdFromObject(mesh)
        ;(batched.userData.__viewerBatchMeta as any[])[instanceId] = {
          elementId,
          label:
            mesh?.userData?.name ||
            mesh?.userData?.label ||
            mesh?.name ||
            '构件',
          ifcId:
            guessIfcId(mesh?.userData) ||
            (looksLikeIfcGuid(mesh?.name) ? String(mesh.name) : undefined),
        }
        removed.add(mesh)
        totalBatchedInstances++
      }
    }

    batched.computeBoundingBox?.()
    batched.computeBoundingSphere?.()

    root.add(batched)

    for (const m of meshes) m.parent?.remove(m)
    batchedCount++
  }

  // Ensure frustum culling is enabled for remaining meshes
  root.traverse((obj: any) => {
    if (obj?.isMesh || obj?.isBatchedMesh) obj.frustumCulled = true
  })

  return {
    batchedCount,
    totalBatchedInstances,
    skippedMultiMaterial,
    preBatchTransparentMeshCount,
    skippedOther,
  }
}

function addLoadedRoot(root: any, label: string, meta?: { fileId?: number; projectId?: number }) {
  if (!root) {
    statusText.value = 'Load failed: empty model.'
    return
  }

  root.userData = root.userData ?? {}
  root.userData.__viewerItemId = String(nextItemId++)
  root.userData.__viewerLabel = label
  if (meta?.fileId) {
    root.userData.__viewerFileId = meta.fileId
  }
  if (meta?.projectId) {
    root.userData.__viewerProjectId = meta.projectId
  }
  loadedRoots.push(root)
  contentGroup?.add(root)

  applyRendererToneMapping()
  const materialChanged = applyMaterialMode(root, materialMode.value)

  statusText.value = `Optimizing: ${label}`
  clearPickedElement()
  const {
    batchedCount,
    totalBatchedInstances,
    skippedMultiMaterial,
    preBatchTransparentMeshCount,
    skippedOther,
  } = optimizeRoot(root)
  fitCameraToObject(root)
  // Ensure world matrices are fully up-to-date after batching + recentering before the first render.
  root.updateMatrixWorld?.(true)
  statusText.value = `Loaded: ${label} (mode ${materialMode.value}, changed ${materialChanged}, batched ${batchedCount})`
  updateLoadedFlags()
  rebuildLoadedItems()
  rebuildElementIndex()
  applyTransformSelection()
  updateBoundsHelpers()
  logModelStats(root, {
    materialMode: materialMode.value,
    materialChanged,
    batchedCount,
    totalBatchedInstances,
    skippedMultiMaterial,
    preBatchTransparentMeshCount,
    skippedOther,
  })
  void loadBimTreeForRoot(root)
  // Some WebGPU paths will only stabilize after a second frame; schedule an extra render.
  requestRender()
  requestAnimationFrame(() => requestRender())
}

/** 作用：加载 glTF/GLB URL，接入场景并完成合批、索引与 UI 状态更新。 */
function loadGltfUrl(url: string, label: string, meta?: { fileId?: number; projectId?: number }) {
  if (!scene) return

  const loader = new GLTFLoader()
  statusText.value = `Loading: ${label}`

  loader.load(
    url,
    (gltf: any) => {
      const root = gltf?.scene ?? gltf?.scenes?.[0]
      if (!root) {
        statusText.value = 'Load failed: empty glTF scene.'
        return
      }
      addLoadedRoot(root, label, meta)
    },
    (e: any) => {
      if (!e?.total) return
      const pct = Math.round((e.loaded / e.total) * 100)
      statusText.value = `Loading: ${label} (${pct}%)`
    },
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(err)
      statusText.value = `Load failed: ${label}`
    },
  )
}

/** 作用：加载 glTF/GLB Blob。 */
function loadGltfBlob(blob: Blob, label: string, meta?: { fileId?: number; projectId?: number }) {
  const url = URL.createObjectURL(blob)
  loadedObjectUrls.push(url)
  loadGltfUrl(url, label, meta)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchIfcGlbWithRetry(
  projectId: number,
  fileId: number,
  label: string,
) {
  const maxAttempts = 40
  const delayMs = 3000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        statusText.value = `BIM 资源生成中... (${attempt}/${maxAttempts})`
      } else {
        statusText.value = `Downloading: ${label}`
      }
      const glbBlob = await getIfcGlbFile(projectId, fileId)
      if (glbBlob instanceof Blob) return glbBlob
      throw new Error('invalid glb response')
    } catch (error: any) {
      const status = error?.response?.status
      const code = error?.response?.data?.code
      if (status === 409 || code === 409) {
        await sleep(delayMs)
        continue
      }
      throw error
    }
  }

  statusText.value = `BIM 资源生成超时：${label}`
  return null
}

function normalizeProjectId() {
  const value = Number(selectedProjectId.value)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.trunc(value)
}

function normalizeFileId(value: string) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.trunc(num)
}

function isIfcFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ext === 'ifc'
}

/** 作用：上传 IFC 并在服务端转换后加载 GLB。 */
async function uploadIfcAndLoad(file: File) {
  if (isUploading.value) {
    statusText.value = '正在上传，请稍后。'
    return
  }

  if (selectedFileType.value !== 'BIM') {
    statusText.value = '当前仅支持 BIM（.ifc）上传'
    return
  }

  const projectId = normalizeProjectId()
  if (!projectId) {
    statusText.value = '请先选择项目'
    return
  }

  isDragging.value = false
  isUploading.value = true
  statusText.value = `Uploading: ${file.name} (0%)`

  let uploadedFile: ProjectFile | null = null
  try {
    const { FileUploader } = await import('@/utils/upload')
    const uploader = new FileUploader({
      projectId,
      type: 'bim',
      file,
      onProgress: (progress: number) => {
        statusText.value = `Uploading: ${file.name} (${progress}%)`
      },
      onSuccess: (fileInfo: ProjectFile) => {
        uploadedFile = fileInfo
      },
      onError: (error: Error) => {
        if (enableDebugLogs.value) {
          // eslint-disable-next-line no-console
          console.error(error)
        }
        statusText.value = `Upload failed: ${file.name}`
      },
    })

    await uploader.start()

    if (!uploadedFile?.id) {
      statusText.value = `Upload failed: ${file.name}`
      return
    }

    const label = uploadedFile.originalName || file.name
    const glbBlob = await fetchIfcGlbWithRetry(
      projectId,
      uploadedFile.id,
      label,
    )
    if (!glbBlob) {
      return
    }
    loadGltfBlob(glbBlob, label, { fileId: uploadedFile.id, projectId })
  } catch (error) {
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
    if (!statusText.value.startsWith('Upload failed')) {
      statusText.value = `Upload failed: ${file.name}`
    }
  } finally {
    isUploading.value = false
  }
}

async function loadExistingBimById(
  fileId: number,
  label?: string,
  options: { manageUploading?: boolean } = {},
) {
  const manageUploading = options.manageUploading !== false
  if (manageUploading && isUploading.value) {
    statusText.value = '正在处理，请稍后。'
    return
  }
  const projectId = normalizeProjectId()
  if (!projectId) {
    statusText.value = '请先选择项目'
    return
  }

  if (manageUploading) isUploading.value = true
  const displayLabel = label || `BIM-${fileId}`
  try {
    const glbBlob = await fetchIfcGlbWithRetry(projectId, fileId, displayLabel)
    if (glbBlob) loadGltfBlob(glbBlob, displayLabel, { fileId, projectId })
  } catch (error) {
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.error('加载已上传 BIM 失败:', error)
    }
    statusText.value = `加载失败: ${displayLabel}`
  } finally {
    if (manageUploading) isUploading.value = false
  }
}

async function loadSelectedExistingBims() {
  if (isUploading.value) {
    statusText.value = '正在处理，请稍后。'
    return
  }
  const selected = selectedExistingBimIds.value.slice()
  if (!selected.length) return

  const pending = selected.filter((id) => !loadedBimIdSet.value.has(id))
  if (!pending.length) {
    statusText.value = '所选 BIM 已加载'
    return
  }

  isUploading.value = true
  try {
    for (const id of pending) {
      const fileId = normalizeFileId(id)
      if (!fileId) continue
      const file = existingBimFiles.value.find((item) => item.id === id)
      await loadExistingBimById(fileId, file?.label, { manageUploading: false })
    }
  } finally {
    isUploading.value = false
  }
}

async function applyRouteSelection() {
  const projectId = Number(route.query.projectId)
  const fileId = Number(route.query.fileId)
  if (!Number.isFinite(projectId) || projectId <= 0 || !Number.isFinite(fileId) || fileId <= 0) return

  selectedProjectId.value = String(projectId)
  selectedFileType.value = 'BIM'
  showTreePanel.value = true
  await loadExistingBimFiles(projectId)

  selectedExistingBimIds.value = [String(fileId)]
  const fileName = typeof route.query.fileName === 'string' ? route.query.fileName : ''
  await loadExistingBimById(fileId, fileName || undefined)
}

/** 作用：根据文件类型触发 IFC 上传。 */
function handleBimFile(file: File) {
  if (!isIfcFile(file)) {
    statusText.value = `仅支持 .ifc：${file.name}`
    return
  }
  void uploadIfcAndLoad(file)
}

/** 作用：打开模型文件选择框（ifc）。 */
function openFilePicker() {
  if (!selectedProjectId.value) {
    statusText.value = '请先选择项目'
    return
  }
  if (!selectedFileType.value) {
    statusText.value = '请先选择文件类型'
    return
  }
  if (selectedFileType.value !== 'BIM') {
    statusText.value = '当前仅支持 BIM（.ifc）上传'
    return
  }
  fileInputEl.value?.click()
}

/** 作用：处理模型文件选择事件并触发加载。 */
function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  if (isUploading.value) {
    statusText.value = '正在上传，请稍后。'
    input.value = ''
    return
  }
  if (!selectedProjectId.value || selectedFileType.value !== 'BIM') {
    statusText.value = '请先选择项目和 BIM 文件类型'
    input.value = ''
    return
  }
  if (files.length > 1) {
    statusText.value = '一次只能上传一个 BIM，将上传第一个文件。'
  }
  handleBimFile(files[0])
  input.value = ''
}

/** 作用：拖拽进入画布区域时启用拖拽态并阻止浏览器默认行为。 */
function onDragOver(ev: DragEvent) {
  ev.preventDefault()
  if (isUploading.value) {
    isDragging.value = false
    return
  }
  if (!selectedProjectId.value || selectedFileType.value !== 'BIM') {
    isDragging.value = false
    return
  }
  isDragging.value = true
}

/** 作用：拖拽离开时退出拖拽态。 */
function onDragLeave() {
  isDragging.value = false
}

/** 作用：处理拖拽释放文件并触发模型加载。 */
function onDrop(ev: DragEvent) {
  ev.preventDefault()
  isDragging.value = false
  if (isUploading.value) {
    statusText.value = '正在上传，请稍后。'
    return
  }
  if (!selectedProjectId.value || selectedFileType.value !== 'BIM') {
    statusText.value = '请先选择项目和 BIM 文件类型'
    return
  }
  const files = ev.dataTransfer?.files
  if (!files?.length) return
  if (files.length > 1) {
    statusText.value = '一次只能上传一个 BIM，将上传第一个文件。'
  }
  handleBimFile(files[0])
}

/** 作用：根据材质模式设置 renderer 的色调映射（unlit 关闭 toneMapping）。 */
function applyRendererToneMapping() {
  if (!renderer) return
  renderer.toneMapping =
    materialMode.value === 'unlit'
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
}

/** 作用：材质模式切换时对已加载内容批量替换材质，并触发重渲染。 */
function onMaterialModeChange() {
  if (!contentGroup) return
  clearPickedElement()
  applyMaterialMode(contentGroup, materialMode.value)
  applyRendererToneMapping()
  requestRender()
}

/** 作用：包围盒显示开关变化时刷新辅助线。 */
function onShowBoundsChange() {
  updateBoundsHelpers()
}

/** 作用：网格显示开关变化时控制网格可见性。 */
function onShowGridChange() {
  if (gridHelper) {
    gridHelper.visible = showGrid.value
    requestRender()
  }
}

/** 作用：编辑模式开关变化时（解绑/绑定）更新 TransformControls 状态。 */
function onEditModeChange() {
  if (editMode.value && !selectedItemId.value) {
    selectedItemId.value = loadedItems.value[0]?.id ?? ''
  }
  if (!editMode.value) {
    transformControls?.detach?.()
    if (transformHelper) transformHelper.visible = false
  }
  applyTransformSelection()
  resetOrientationFix()
}

/** 作用：切换当前选中加载项时，更新 gizmo/包围盒/朝向基准。 */
function onSelectedItemChange() {
  applyTransformSelection()
  updateBoundsHelpers()
  resetOrientationFix()
  const item = getSelectedItem()
  if (item?.obj?.quaternion) {
    if (!item.obj.userData) item.obj.userData = {}
    item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
  }
}

/** 作用：将相机聚焦到当前选中加载项。 */
function focusSelected() {
  const item = loadedItems.value.find((i) => i.id === selectedItemId.value)
  if (!item) return
  fitCameraToObject(item.obj)
  requestRender()
}

/** 作用：重置相机到默认视角。 */
function resetView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 1.5, 50)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  requestRender()
}

/** 作用：切换到前视图。 */
function setFrontView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 1.5, 50)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  requestRender()
}

/** 作用：切换到俯视图。 */
function setTopView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(0, 100, 0.1)
  camera.lookAt(0, 0, 0)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  requestRender()
}

/** 作用：切换到侧视图。 */
function setSideView() {
  if (!camera || !controls) return
  controls.target.set(0, 0, 0)
  camera.position.set(50, 1.5, 0)
  camera.near = 0.01
  camera.far = 5000
  camera.updateProjectionMatrix()
  controls.update()
  requestRender()
}

/** 作用：执行一帧渲染（含控制器更新与高亮 overlay 同步）。 */
function renderFrame() {
  renderRequested = false
  if (!renderer || !scene || !camera) return
  stats?.begin?.()
  controls?.update?.()
  camera.updateMatrixWorld?.()
  transformHelper?.updateMatrixWorld?.(true)
  updateHighlightedOverlayTransform()
  renderer.render(scene, camera)
  stats?.end?.()
}

/** 作用：请求一次渲染帧（合并多次请求，避免重复 RAF）。 */
function requestRender() {
  if (renderRequested) return
  renderRequested = true
  animationHandle = requestAnimationFrame(renderFrame)
}

/** 作用：在交互（拖拽/旋转）时降低合批剔除/排序开销，提升帧率。 */
function setInteractionMode(isInteracting: boolean) {
  if (!contentGroup) return
  contentGroup.traverse((obj: any) => {
    if (!obj?.isBatchedMesh) return
    obj.perObjectFrustumCulled = !isInteracting
    obj.sortObjects = false
  })
}

/** 作用：根据容器尺寸与 DPR 重新设置 renderer/camera。 */
function resizeRenderer() {
  if (!containerEl.value || !renderer || !camera) return
  const { width, height } = containerEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))
  const dpr = Math.min(window.devicePixelRatio ?? 1, dprCap)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

/** 作用：初始化 three.js 场景（WebGPURenderer、相机、控制器、拾取/交互等）。 */
async function initThree() {
  const el = containerEl.value
  if (!el) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1020')

  // 添加网格辅助线
  gridHelper = new THREE.GridHelper(10000, 100, 0x444466, 0x222244)
  gridHelper.position.y = -10.01
  scene.add(gridHelper)

  contentGroup = new THREE.Group()
  scene.add(contentGroup)

  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000)
  camera.position.set(0, 1.5, 4)

  renderer = new WebGPURenderer({ antialias: true })
  dprCap = 1.25
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, dprCap))
  renderer.setClearColor(0x0b1020, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  el.appendChild(renderer.domElement)

  raycaster = new THREE.Raycaster()
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.enabled = true
  transformHelper = transformControls.getHelper()
  transformHelper.visible = false
  transformControls.setSize?.(1.5)
  transformControls.setSpace?.('world')
  transformHelper.frustumCulled = false
  transformHelper.traverse?.((o: any) => {
    o.frustumCulled = false
    if (o.material) {
      if (Array.isArray(o.material))
        o.material.forEach((m: any) => (m.depthTest = false))
      else o.material.depthTest = false
    }
  })
  transformControls.addEventListener?.('change', () => {
    // If the user transforms via gizmo, treat that as the new "base" orientation
    // (unless we're currently applying an extra fix offset).
    if (
      orientationDegX.value === 0 &&
      orientationDegY.value === 0 &&
      orientationDegZ.value === 0
    ) {
      const item = getSelectedItem()
      const obj = item?.obj
      if (obj?.quaternion) {
        if (!obj.userData) obj.userData = {}
        obj.userData.__orientationBaseQuat = obj.quaternion.clone()
      }
    }
    updateBoundsHelpers()
    requestRender()
  })
  transformControls.addEventListener?.('dragging-changed', (e: any) => {
    const dragging = !!e?.value
    if (controls) controls.enabled = !dragging
    setInteractionMode(dragging)
  })
  scene.add(transformHelper)

  stats = new Stats()
  stats.dom.style.position = 'absolute'
  stats.dom.style.right = '16px'
  stats.dom.style.bottom = '16px'
  stats.dom.style.left = 'auto'
  stats.dom.style.top = 'auto'
  stats.dom.style.zIndex = '20'
  stats.dom.style.opacity = '0.9'
  el.appendChild(stats.dom)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 1.3)
  key.position.set(3, 6, 4)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x99bbff, 0.5)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minDistance = 0.1
  controls.maxDistance = 1000
  controls.addEventListener?.('change', requestRender)
  controls.addEventListener?.('start', () => {
    setInteractionMode(true)
    dprCap = 0.75
    resizeRenderer()
    requestRender()
  })
  controls.addEventListener?.('end', () => {
    setInteractionMode(false)
    dprCap = 1.25
    resizeRenderer()
    requestRender()
  })

  resizeObserver = new ResizeObserver(() => {
    resizeRenderer()
    requestRender()
  })
  resizeObserver.observe(el)

  renderer.domElement.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (!raycaster || !camera || !contentGroup) return
    if (!loadedItems.value.length) return
    const rect = renderer.domElement.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    raycaster.setFromCamera({ x, y }, camera)
    const hits = raycaster.intersectObjects(contentGroup.children, true)
    if (!hits.length) return

    const pickedHit =
      (hits as any[]).find((h) => !h?.object?.userData?.__viewerPickIgnore) ??
      (hits[0] as any)

    let top: any = pickedHit.object
    while (top && top.parent && top.parent !== contentGroup) top = top.parent

    const hit = pickedHit as any
    const topIsGltf = loadedRoots.includes(top)
    const wantElementPick =
      enableElementPicking.value && topIsGltf && (!editMode.value || ev.altKey)
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.log('[Pick] pointerdown', {
        editMode: editMode.value,
        altKey: ev.altKey,
        enableElementPicking: enableElementPicking.value,
        topType: top?.type,
        topIsGltf,
        hitObjectType: hit?.object?.type,
        hitIsBatched: !!hit?.object?.isBatchedMesh,
        hitBatchId: typeof hit?.batchId === 'number' ? hit.batchId : undefined,
        hits: hits.length,
      })
    }
    if (wantElementPick) {
      const highlightColor = new THREE.Color('#ffcf4a')

      restoreHighlightedElement()
      if (hit?.object?.isBatchedMesh && typeof hit.batchId === 'number') {
        const meta = hit.object?.userData?.__viewerBatchMeta?.[hit.batchId]
        // const elementId = normalizeMetaKey(
        //   meta?.elementId ?? meta?.ifcId ?? meta?.label,
        // )
        pickedElement.value = {
          label: meta?.label ?? '构件',
          // ifcId: elementId || meta?.ifcId,
          sourceLabel: top?.userData?.__viewerLabel,
        }
        if (enableDebugLogs.value) {
          // eslint-disable-next-line no-console
          console.log('[Pick] element (batched)', {
            batchId: hit.batchId,
            meta,
            topLabel: top?.userData?.__viewerLabel,
          })
        }
        highlightBatched(hit.object, hit.batchId, highlightColor)
      } else {
        const mesh = hit.object
        const elementId = getElementIdFromObject(mesh)
        pickedElement.value = {
          label:
            mesh?.name ||
            mesh?.userData?.name ||
            mesh?.userData?.label ||
            '构件',
          ifcId: elementId || guessIfcId(mesh?.userData),
          sourceLabel: top?.userData?.__viewerLabel,
        }
        if (enableDebugLogs.value) {
          // eslint-disable-next-line no-console
          console.log('[Pick] element (mesh)', {
            meshName: mesh?.name,
            meshType: mesh?.type,
            topLabel: top?.userData?.__viewerLabel,
            userDataSummary: debugUserDataSummary(mesh?.userData),
            userData: mesh?.userData,
          })
        }
        highlightMesh(mesh, highlightColor)
      }
      requestRender()
      return
    }

    if (!editMode.value) return
    const id = top?.userData?.__viewerItemId
    if (!id) return
    selectedItemId.value = String(id)
    if (enableDebugLogs.value) {
      // eslint-disable-next-line no-console
      console.log('[Edit] pick', {
        id: selectedItemId.value,
        pickedType: top?.type,
      })
    }
    applyTransformSelection()
    updateBoundsHelpers()
    resetOrientationFix()
    const item = getSelectedItem()
    if (item?.obj?.quaternion) {
      if (!item.obj.userData) item.obj.userData = {}
      item.obj.userData.__orientationBaseQuat = item.obj.quaternion.clone()
    }
  })

  resizeRenderer()

  statusText.value = 'WebGPU initializing...'
  await renderer.init()
  applyRendererToneMapping()
  statusText.value = '准备就绪，上传 BIM（.ifc）查看。'
  requestRender()
}

watch([selectedProjectId, selectedFileType], () => {
  if (selectedFileType.value !== 'BIM') {
    existingBimFiles.value = []
    selectedExistingBimIds.value = []
    return
  }
  const projectId = normalizeProjectId()
  if (!projectId) {
    existingBimFiles.value = []
    selectedExistingBimIds.value = []
    return
  }
  void loadExistingBimFiles(projectId)
})

onMounted(async () => {
  await loadProjectList()
  if (!webgpuSupported.value) {
    statusText.value =
      'WebGPU not supported. Please use Chrome/Edge with WebGPU enabled.'
    return
  }
  await initThree()
  await applyRouteSelection()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationHandle)
  resizeObserver?.disconnect()
  controls?.dispose()
  clearScene()
  transformControls?.dispose?.()
  transformHelper?.removeFromParent?.()
  renderer?.dispose()
  renderer?.domElement?.remove()
  stats?.dom?.remove?.()

  resizeObserver = null
  controls = null
  camera = null
  scene = null
  renderer = null
  stats = null
  contentGroup = null
  transformControls = null
  raycaster = null
  transformHelper = null
})
</script>

<style lang="scss" scoped>
@use './index.scss';
</style>
