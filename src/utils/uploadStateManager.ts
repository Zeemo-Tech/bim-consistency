import type { FileType, ScanIngestMode } from '@/api/fileManage'

/**
 * 上传状态信息
 */
export interface UploadState {
  buildingName?: string
  uploadId: number
  fileHash: string
  fileName: string
  fileSize: number
  fileLastModified?: number
  fileType: FileType
  floorName?: string
  projectId: number
  producedAt?: string
  chunkSize: number
  totalChunks: number
  uploadedChunks: number[]
  progress: number
  timestamp: number // 保存时间戳
  description?: string // 文件描述
  /** 点云入库方式（仅 type=scan）。 */
  ingestMode?: ScanIngestMode
  /** 后处理点云关联的轨迹上传会话 ID。 */
  trajectoryUploadId?: number
  /** 归档信息。 */
  componentType?: string
  archiveSerial?: string
  archiveCode?: string
}

/** localStorage 存储键 */
const STORAGE_KEY = 'pending_uploads'

/** 上传状态过期时间（7天，单位：毫秒） */
const EXPIRY_DURATION = 7 * 24 * 60 * 60 * 1000

const normalizeIdentityValue = (value?: string): string => value?.trim() || ''

const buildUploadIdentity = (state: {
  projectId: number
  fileType: FileType
  fileHash: string
  buildingName?: string
  floorName?: string
  producedAt?: string
}): string =>
  [
    state.projectId,
    state.fileType,
    state.fileHash,
    normalizeIdentityValue(state.buildingName),
    normalizeIdentityValue(state.floorName),
    normalizeIdentityValue(state.producedAt),
  ].join('::')

/**
 * 上传状态管理器 - 用于保存和恢复断点续传状态
 */
export class UploadStateManager {
  /**
   * 保存上传状态
   */
  static saveUploadState(state: UploadState): void {
    try {
      const states = this.getAllUploadStates()
      const updatedState = { ...state, timestamp: Date.now() }
      const identity = buildUploadIdentity(updatedState)
      const nextStates = states
        .filter(
          (s) =>
            s.uploadId !== updatedState.uploadId &&
            buildUploadIdentity(s) !== identity,
        )
        .concat(updatedState)
        .sort((a, b) => b.timestamp - a.timestamp)

      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStates))
    } catch (error) {
      console.error('[UploadStateManager] 保存上传状态失败:', error)
    }
  }

  /**
   * 获取所有上传状态（自动过滤过期状态）
   */
  static getAllUploadStates(): UploadState[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []

      const states: UploadState[] = JSON.parse(data)
      const expiryTime = Date.now() - EXPIRY_DURATION
      const dedupedStates: UploadState[] = []
      const seenUploadIds = new Set<number>()
      const seenIdentities = new Set<string>()

      states
        .filter((state) => state.timestamp > expiryTime)
        .sort((a, b) => b.timestamp - a.timestamp)
        .forEach((state) => {
          const identity = buildUploadIdentity(state)
          if (
            seenUploadIds.has(state.uploadId) ||
            seenIdentities.has(identity)
          ) {
            return
          }
          seenUploadIds.add(state.uploadId)
          seenIdentities.add(identity)
          dedupedStates.push(state)
        })

      if (dedupedStates.length !== states.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupedStates))
      }

      return dedupedStates
    } catch (error) {
      console.error('[UploadStateManager] 获取上传状态失败:', error)
      return []
    }
  }

  /**
   * 根据 uploadId 获取上传状态
   */
  static getUploadState(uploadId: number): UploadState | null {
    const states = this.getAllUploadStates()
    return states.find((s) => s.uploadId === uploadId) || null
  }

  /**
   * 根据文件 hash 获取上传状态
   */
  static getUploadStateByHash(fileHash: string): UploadState | null {
    const states = this.getAllUploadStates()
    return states.find((s) => s.fileHash === fileHash) || null
  }

  /**
   * 根据上传身份获取上传状态
   */
  static findMatchingUploadState(query: {
    projectId: number
    fileType: FileType
    fileHash: string
    buildingName?: string
    floorName?: string
    producedAt?: string
  }): UploadState | null {
    const identity = buildUploadIdentity(query)
    const states = this.getAllUploadStates()
    return (
      states.find((state) => buildUploadIdentity(state) === identity) || null
    )
  }

  /**
   * 根据项目 ID 获取所有上传状态
   */
  static getUploadStatesByProjectId(projectId: number): UploadState[] {
    const states = this.getAllUploadStates()
    return states.filter((s) => s.projectId === projectId)
  }

  /**
   * 删除上传状态
   */
  static removeUploadState(uploadId: number): void {
    try {
      const states = this.getAllUploadStates()
      const filteredStates = states.filter((s) => s.uploadId !== uploadId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredStates))
    } catch (error) {
      console.error('[UploadStateManager] 删除上传状态失败:', error)
    }
  }

  /**
   * 清空所有上传状态
   */
  static clearAllUploadStates(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('[UploadStateManager] 清空上传状态失败:', error)
    }
  }

  /**
   * 更新上传进度
   */
  static updateProgress(
    uploadId: number,
    progress: number,
    uploadedChunks: number[],
  ): void {
    const state = this.getUploadState(uploadId)
    if (!state) return

    state.progress = progress
    state.uploadedChunks = uploadedChunks
    state.timestamp = Date.now()
    this.saveUploadState(state)
  }
}
