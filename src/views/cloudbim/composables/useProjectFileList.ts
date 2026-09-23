import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteProjectFile,
  getProjectBuildings,
  getProjectFilesByProjectId,
  type FileType,
  type ProjectBuildingInfo,
  type ProjectFileInfo,
} from '@/api/fileManage'

/** 作用：统一楼栋名比较（忽略大小写与首尾空格）。 */
function normalizeBuildingName(value?: string | null) {
  return (value || '').trim().toUpperCase()
}

/**
 * 加载当前项目下指定类型的文件，并提供预览/删除能力。
 * 数据源沿用文件管理模块使用的 zhongjian-back 接口。
 */
export function useProjectFileList(kinds: FileType[]) {
  const route = useRoute()
  const router = useRouter()

  const projectId = computed(() => {
    const value = Number(route.query.projectId)
    return Number.isFinite(value) && value > 0 ? value : 0
  })

  const projectName = computed(() => {
    const value = route.query.projectName
    return typeof value === 'string' ? value : ''
  })

  const files = ref<ProjectFileInfo[]>([])
  /** 未按类型过滤的全部文件，用于按归档编号解析点云关联的 BIM。 */
  const allFiles = ref<ProjectFileInfo[]>([])
  const loading = ref(false)
  const buildingOptions = ref<string[]>([])
  /** 项目楼栋（含各自 BIM），用于「扫描点云 ↔ 设计模型」一一匹配。 */
  const buildings = ref<ProjectBuildingInfo[]>([])

  /** 处理中状态的文件需要轮询刷新，避免上传后状态一直停留在「处理中」。 */
  let pollTimer: ReturnType<typeof setTimeout> | undefined

  function isPendingStatus(status: ProjectFileInfo['status']) {
    return status === 'processing' || status === 'queued'
  }

  function schedulePoll() {
    if (pollTimer) return
    pollTimer = setTimeout(() => {
      pollTimer = undefined
      void loadFiles({ silent: true })
    }, 5000)
  }

  function stopPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = undefined
    }
  }

  onBeforeUnmount(stopPoll)

  async function loadFiles(options: { silent?: boolean } = {}) {
    if (!projectId.value) {
      files.value = []
      return
    }

    if (!options.silent) {
      loading.value = true
    }
    try {
      const response = await getProjectFilesByProjectId(projectId.value)
      const groups = response.data || []
      allFiles.value = groups.flatMap((group) => group.files)
      files.value = groups
        .filter((group) => kinds.includes(group.type))
        .flatMap((group) => group.files)
      if (files.value.some((file) => isPendingStatus(file.status))) {
        schedulePoll()
      } else {
        stopPoll()
      }
    } catch (error: any) {
      if (!options.silent) {
        files.value = []
        allFiles.value = []
        ElMessage.error(
          error?.response?.data?.msg || error?.message || '加载文件列表失败',
        )
      }
    } finally {
      if (!options.silent) {
        loading.value = false
      }
    }
  }

  async function loadBuildings() {
    if (!projectId.value) {
      buildings.value = []
      buildingOptions.value = []
      return
    }

    try {
      const response = await getProjectBuildings(projectId.value)
      buildings.value = response.data || []
      buildingOptions.value = buildings.value
        .map((item) => item.buildingName)
        .filter((name): name is string => Boolean(name))
    } catch {
      buildings.value = []
      buildingOptions.value = []
    }
  }

  /**
   * 作用：为某个文件解析「一一对应」的设计模型（BIM）。
   *
   * 参考项目在归档时用归档编号把点云与 BIM 绑定；本项目后端保持不变，
   * 因此按楼栋（buildingName）在项目楼栋列表里匹配对应 BIM：
   * - 扫描点云带有楼栋名时，匹配同楼栋的 BIM；
   * - 项目只有一个 BIM 时，直接匹配该 BIM（兜底）。
   */
  function linkedBimForFile(file: ProjectFileInfo): ProjectFileInfo | null {
    // 1) 归档编号关联：直接按 linkedBimFileId 解析设计模型。
    if (file.linkedBimFileId) {
      const linked = allFiles.value.find(
        (item) => item.type === 'bim' && item.id === file.linkedBimFileId,
      )
      if (linked) return linked
    }
    // 2) 兼容旧数据：按楼栋名匹配。
    const bims = buildings.value
      .map((item) => item.bimFile)
      .filter((bim): bim is ProjectFileInfo => Boolean(bim))
    const target = normalizeBuildingName(file.buildingName)
    if (target) {
      const matched = buildings.value.find(
        (item) =>
          item.bimFile && normalizeBuildingName(item.buildingName) === target,
      )
      if (matched?.bimFile) return matched.bimFile
    }
    if (bims.length === 1) return bims[0]
    return null
  }

  async function removeFile(file: ProjectFileInfo) {
    try {
      await ElMessageBox.confirm(
        `确定删除文件“${file.originalName}”吗？相关预览、配准和分析结果也会被删除。`,
        '删除文件',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
        },
      )
    } catch {
      return
    }

    try {
      await deleteProjectFile(projectId.value, file.id)
      ElMessage.success('文件已删除')
      await loadFiles()
    } catch (error: any) {
      ElMessage.error(
        error?.response?.data?.msg || error?.message || '删除文件失败',
      )
    }
  }

  function previewFile(file: ProjectFileInfo) {
    if (file.status !== 'stored') {
      ElMessage.warning('文件尚未上传完成，无法预览')
      return
    }

    const routeName =
      file.type === 'cad'
        ? 'PreviewCad'
        : file.type === 'scan'
          ? 'PreviewScan'
          : file.type === 'gauss'
            ? 'GaussianModel'
            : 'PreviewFile'

    void router.push({
      name: routeName,
      params: { id: file.id },
      query: {
        projectId: projectId.value,
        fileName: file.originalName,
        fileType: file.type,
      },
    })
  }

  /** 进入 BIM-点云分析（配准 / 去噪 / 偏差 / 报告） */
  function enterAnalysis(file: ProjectFileInfo) {
    if (file.status !== 'stored') {
      ElMessage.warning('文件尚未处理完成，暂时不能进入分析')
      return
    }

    // 自动匹配同楼栋的设计模型（BIM），进入分析后无需再手动选择。
    const linkedBim = linkedBimForFile(file)
    if (file.type === 'scan' && !linkedBim) {
      ElMessage.warning(
        '未找到与当前扫描点云匹配的设计模型（BIM），请先上传同一楼栋的 BIM',
      )
      return
    }

    void router.push({
      name: 'AlignmentModel',
      query: {
        projectId: projectId.value,
        projectName: projectName.value,
        scanId: file.id,
        pointCloudName: file.originalName,
        ...(linkedBim
          ? { bimId: String(linkedBim.id), bimName: linkedBim.originalName }
          : {}),
        returnTo: route.fullPath,
      },
    })
  }

  /** 进入四分屏查看器（迁移自原「四分屏」入口）。 */
  function openFourScreen(file: ProjectFileInfo) {
    if (!projectId.value) {
      ElMessage.warning('缺少项目ID，无法进入四分屏')
      return
    }
    if (file.status !== 'stored') {
      ElMessage.warning('文件尚未处理完成，暂时不能进入四分屏')
      return
    }
    void router.push({
      name: 'TwoScreenIndex',
      query: {
        projectId: String(projectId.value),
        projectName: projectName.value,
        scanFileId: String(file.id),
      },
    })
  }

  return {
    projectId,
    files,
    loading,
    buildingOptions,
    buildings,
    loadFiles,
    loadBuildings,
    linkedBimForFile,
    removeFile,
    previewFile,
    enterAnalysis,
    openFourScreen,
  }
}
