import type {
  FileType,
  UploadStatus,
  InitUploadParams,
  ProjectFile,
  CompleteUploadParams,
  ScanIngestMode,
} from '@/api/fileManage'
import {
  initFileUpload,
  getUploadStatus,
  uploadFileChunk,
  cancelUpload,
  completeUpload,
} from '@/api/fileManage'
import { UploadStateManager } from './uploadStateManager'

/**
 * 检查 API 响应是否成功
 */
const isSuccessResponse = (code: number): boolean =>
  code === 200 || code === 201

/** 调试模式 - 生产环境请设置为 false */
const DEBUG = import.meta.env.DEV

/** 日志工具 */
const logger = {
  info: (...args: any[]) => DEBUG && console.log('[Upload]', ...args),
  error: (...args: any[]) => console.error('[Upload Error]', ...args),
  warn: (...args: any[]) => DEBUG && console.warn('[Upload Warning]', ...args),
}

/**
 * 文件上传参数
 */
export interface UploadFileParams {
  buildingName?: string
  projectId: number
  type: FileType
  file: File
  floorName?: string
  producedAt?: string
  onProgress?: (progress: number) => void
  onChunkProgress?: (state: ChunkProgressState) => void
  onUploadIdCreated?: (uploadId: number) => void
  onCancelCheck?: () => boolean
  onHashProgress?: (progress: number) => void
  onPhaseChange?: (phase: UploadPhase) => void
  onHashResolved?: (hash: string) => void
  description?: string // 文件描述
  resumeFromState?: boolean // 是否从保存的状态恢复
  existingUploadId?: number // 已存在的 uploadId（用于暂停后的继续上传）
  existingFileHash?: string
  /** 点云入库方式（仅 type=scan）。 */
  ingestMode?: ScanIngestMode
  /** 后处理点云完成时关联的轨迹上传会话 ID。 */
  trajectoryUploadId?: number
  /** 归档信息。 */
  componentType?: string
  archiveSerial?: string
  archiveCode?: string
}

export interface ChunkProgressState {
  completed: number
  total: number
  active?: number
  failed?: number
}

export type UploadPhase = 'hashing' | 'uploading' | 'merging'

const HASH_CACHE_STORAGE_KEY = 'upload:file-hash-cache'
const HASH_CACHE_MAX_ENTRIES = 20

interface HashCacheEntry {
  key: string
  hash: string
  updatedAt: number
}

const buildFileCacheKey = (file: File): string =>
  [file.name, file.size, file.lastModified].join(':')

const readHashCache = (): HashCacheEntry[] => {
  try {
    const raw = sessionStorage.getItem(HASH_CACHE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeHashCache = (entries: HashCacheEntry[]): void => {
  try {
    sessionStorage.setItem(
      HASH_CACHE_STORAGE_KEY,
      JSON.stringify(entries.slice(0, HASH_CACHE_MAX_ENTRIES)),
    )
  } catch {
    logger.warn('写入 hash 缓存失败')
  }
}

const getCachedFileHash = (file: File): string | null => {
  const key = buildFileCacheKey(file)
  const entries = readHashCache()
  const matched = entries.find((entry) => entry.key === key)
  return matched?.hash || null
}

const saveCachedFileHash = (file: File, hash: string): void => {
  const key = buildFileCacheKey(file)
  const entries = readHashCache().filter((entry) => entry.key !== key)
  entries.unshift({
    key,
    hash,
    updatedAt: Date.now(),
  })
  entries.sort((a, b) => b.updatedAt - a.updatedAt)
  writeHashCache(entries)
}

const resolveHashChunkSize = (fileSize: number): number => {
  if (fileSize >= 8 * 1024 * 1024 * 1024) return 16 * 1024 * 1024
  if (fileSize >= 1024 * 1024 * 1024) return 8 * 1024 * 1024
  return 4 * 1024 * 1024
}

const resolveUploadChunkSize = (fileSize: number): number => {
  const minChunkSize = 4 * 1024 * 1024
  const maxChunkSize = 16 * 1024 * 1024
  const targetChunkCount = 1600
  const suggestedChunkSize = Math.ceil(fileSize / targetChunkCount)
  return Math.max(minChunkSize, Math.min(maxChunkSize, suggestedChunkSize))
}

const resolveUploadConcurrency = (totalChunks: number): number => {
  if (totalChunks <= 1) return 1
  if (totalChunks <= 4) return 2
  return 3
}

/**
 * 大文件元数据指纹阈值：16MB。
 * 超过该大小不再读取文件内容（避免浏览器进程读大 Blob 崩溃），
 * 用「大小 + 修改时间 + 文件名」做稳定指纹，去重/续传仍可工作。
 */
const METADATA_FINGERPRINT_THRESHOLD = 16 * 1024 * 1024

/** FNV-1a 32 位哈希（十六进制），仅用于把文件名压缩成短串 */
const fnv1aHex = (input: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildMetadataFingerprint = (file: File): string =>
  `meta-${file.size}-${file.lastModified}-${fnv1aHex(file.name)}`

/**
 * 计算文件 hash - 使用 Web Worker 避免阻塞主线程
 */
export const calculateFileHash = (
  file: File,
  onHashProgress?: (progress: number) => void,
): Promise<string> => {
  const cachedHash = getCachedFileHash(file)
  if (cachedHash) {
    onHashProgress?.(100)
    return Promise.resolve(cachedHash)
  }

  // 大文件（高斯/归档 zip 动辄数百 MB）不读取内容：仅用「大小 + 修改时间 + 文件名」
  // 生成元数据指纹。整包读取会触发浏览器进程读大 Blob 的崩溃
  // （Crash 报告：Process Google Chrome / ThreadPoolForegroundWorker / SIGTRAP）。
  if (file.size >= METADATA_FINGERPRINT_THRESHOLD) {
    const hash = buildMetadataFingerprint(file)
    saveCachedFileHash(file, hash)
    onHashProgress?.(100)
    return Promise.resolve(hash)
  }

  return new Promise((resolve, reject) => {
    // 创建 Web Worker
    const worker = new Worker(
      new URL('../workers/hash.worker.ts', import.meta.url),
      { type: 'module' },
    )

    // 监听 Worker 消息
    worker.onmessage = (e: MessageEvent) => {
      const { type, progress, hash, error } = e.data

      switch (type) {
        case 'progress':
          // 更新 hash 计算进度
          onHashProgress?.(progress)
          break

        case 'success':
          // Hash 计算成功
          worker.terminate()
          saveCachedFileHash(file, hash)
          resolve(hash)
          break

        case 'error':
          // Hash 计算失败
          worker.terminate()
          reject(new Error(error || '计算文件 hash 失败'))
          break
      }
    }

    worker.onerror = (error) => {
      worker.terminate()
      reject(new Error('Web Worker 错误: ' + error.message))
    }

    // 发送文件给 Worker
    worker.postMessage({
      file,
      chunkSize: resolveHashChunkSize(file.size),
    })
  })
}

/**
 * 初始化上传参数
 */
interface InitializeUploadParams {
  buildingName?: string
  projectId: number
  file: File
  fileHash: string
  floorName?: string
  type: FileType
  producedAt?: string
  existingUploadId?: number
  ingestMode?: ScanIngestMode
  componentType?: string
  archiveSerial?: string
  archiveCode?: string
}

/**
 * 初始化上传结果
 */
interface InitializeUploadResult {
  uploadId: number
  uploadStatus: UploadStatus
}

/**
 * 初始化上传或恢复已存在的上传任务
 */
const initializeUpload = async (
  params: InitializeUploadParams,
): Promise<InitializeUploadResult> => {
  const {
    buildingName,
    projectId,
    file,
    fileHash,
    floorName,
    type,
    producedAt,
    existingUploadId,
    ingestMode,
    componentType,
    archiveSerial,
    archiveCode,
  } = params

  // 如果有已存在的 uploadId（暂停后继续上传），直接使用它
  if (existingUploadId) {
    logger.info(`继续上传，使用已有的 uploadId: ${existingUploadId}`)
    const statusResult = await getUploadStatus(existingUploadId)
    if (!isSuccessResponse(statusResult.code)) {
      throw new Error(statusResult.msg || '获取上传状态失败')
    }
    return { uploadId: existingUploadId, uploadStatus: statusResult.data }
  }

  // 初始化新的上传任务
  const initParams: InitUploadParams = {
    buildingName,
    chunkSize: resolveUploadChunkSize(file.size),
    fileHash,
    fileName: file.name,
    fileSize: file.size,
    floorName,
    type,
    producedAt,
    ingestMode,
    componentType,
    archiveSerial,
    archiveCode,
  }

  try {
    const initResult = await initFileUpload(projectId, initParams)
    if (!isSuccessResponse(initResult.code)) {
      throw new Error(initResult.msg || '初始化上传失败')
    }
    return { uploadId: initResult.data.uploadId, uploadStatus: initResult.data }
  } catch (error: any) {
    // 处理 409 冲突错误（文件正在上传或已存在）
    if (error.response?.status === 409) {
      const responseData = error.response?.data
      const extractedUploadId =
        responseData?.data?.uploadId || responseData?.uploadId
      if (extractedUploadId) {
        logger.warn(
          `文件已存在或正在上传，使用已有的 uploadId: ${extractedUploadId}`,
        )
        const statusResult = await getUploadStatus(extractedUploadId)
        if (!isSuccessResponse(statusResult.code)) {
          throw new Error(statusResult.msg || '获取上传状态失败')
        }
        return { uploadId: extractedUploadId, uploadStatus: statusResult.data }
      }
      const extractedFileId = responseData?.data?.fileId || responseData?.fileId
      if (extractedFileId) {
        const err = new Error(responseData?.msg || '该文件已存在或正在上传')
        ;(err as any).status = 409
        ;(err as any).data = responseData
        ;(err as any).response = error.response
        throw err
      }
      throw new Error('该文件已存在或正在上传')
    }
    throw error
  }
}

/**
 * 保存上传进度
 */
const saveUploadProgress = (
  uploadId: number,
  file: File,
  fileHash: string,
  type: FileType,
  projectId: number,
  uploadStatus: UploadStatus,
  buildingName?: string,
  producedAt?: string,
  description?: string,
  floorName?: string,
  ingestMode?: ScanIngestMode,
  trajectoryUploadId?: number,
  componentType?: string,
  archiveSerial?: string,
  archiveCode?: string,
): void => {
  const progress = uploadStatus.uploadedChunks?.length
    ? Math.round(
        (uploadStatus.uploadedChunks.length / uploadStatus.totalChunks) * 100,
      )
    : 10

  UploadStateManager.saveUploadState({
    uploadId,
    fileHash,
    fileName: file.name,
    fileSize: file.size,
    fileLastModified: file.lastModified,
    fileType: type,
    buildingName,
    floorName,
    projectId,
    producedAt,
    chunkSize: uploadStatus.chunkSize,
    totalChunks: uploadStatus.totalChunks,
    uploadedChunks: uploadStatus.uploadedChunks || [],
    progress,
    timestamp: Date.now(),
    description,
    ingestMode,
    trajectoryUploadId,
    componentType,
    archiveSerial,
    archiveCode,
  })
}

/**
 * 判断是否为秒传（所有分片都已上传）
 */
const isInstantUpload = (uploadStatus: UploadStatus): boolean => {
  return uploadStatus.uploadedChunks?.length === uploadStatus.totalChunks
}

/**
 * 完成文件上传
 */
const completeFileUpload = async (
  uploadId: number,
  fileHash: string,
  onProgress?: (progress: number) => void,
  extra?: CompleteUploadParams,
): Promise<ProjectFile> => {
  onProgress?.(90)
  const completeResult = await completeUpload(uploadId, {
    fileHash,
    ...(extra || {}),
  })
  if (!isSuccessResponse(completeResult.code)) {
    throw new Error(completeResult.msg || '完成上传失败')
  }
  onProgress?.(100)
  logger.info('上传完成')
  UploadStateManager.removeUploadState(uploadId)
  return completeResult.data
}

/**
 * 统一错误处理
 */
const handleUploadError = (error: any): Error => {
  const statusCode = error?.response?.status
  const responseData = error?.response?.data

  const errorMessages: Record<number, string> = {
    400:
      responseData?.msg ||
      responseData?.message ||
      '文件信息有误，请检查文件格式',
    409: '该文件已存在或正在上传中，请检查文件列表或稍后重试',
    413: '文件大小超出限制，请选择较小的文件',
  }

  if (statusCode && errorMessages[statusCode]) {
    const err = new Error(errorMessages[statusCode])
    ;(err as any).status = statusCode
    ;(err as any).data = responseData
    ;(err as any).response = error?.response
    return err
  }

  if (statusCode && statusCode >= 500) {
    const err = new Error('服务器暂时不可用，请稍后重试')
    ;(err as any).status = statusCode
    ;(err as any).data = responseData
    ;(err as any).response = error?.response
    return err
  }

  if (error.code === 'NETWORK_ERROR') {
    const err = new Error('网络连接异常，请检查网络后重试')
    ;(err as any).status = statusCode
    ;(err as any).data = responseData
    ;(err as any).response = error?.response
    return err
  }

  const err = new Error(error?.message || '上传失败，请重试')
  ;(err as any).status = statusCode
  ;(err as any).data = responseData
  ;(err as any).response = error?.response
  return err
}

/**
 * 上传文件
 */

export const uploadFile = async (
  params: UploadFileParams,
): Promise<ProjectFile> => {
  const {
    buildingName,
    projectId,
    type,
    file,
    floorName,
    producedAt,
    onProgress,
    onChunkProgress,
    onUploadIdCreated,
    onCancelCheck,
    onHashProgress,
    onPhaseChange,
    onHashResolved,
    description,
    resumeFromState,
    existingUploadId,
    existingFileHash,
    ingestMode,
    trajectoryUploadId,
    componentType,
    archiveSerial,
    archiveCode,
  } = params

  try {
    // 1. 计算文件 hash（0% ~ 10%）
    let fileHash = existingFileHash || ''

    if (!fileHash) {
      logger.info('开始计算文件 hash...')
      onPhaseChange?.('hashing')
      const resolvedHash = await calculateFileHash(file, (hashProgress) => {
        const progress = Math.floor(hashProgress * 0.1)
        onProgress?.(progress)
        onHashProgress?.(hashProgress)
      })
      fileHash = resolvedHash
      onHashResolved?.(resolvedHash)
    } else {
      onHashProgress?.(100)
      onProgress?.(10)
    }

    // 2. 初始化上传或获取已存在的上传任务
    onProgress?.(10)
    onPhaseChange?.('uploading')
    let resolvedUploadId = existingUploadId
    let resolvedProducedAt = producedAt
    let resolvedBuildingName = buildingName
    let resolvedFloorName = floorName
    if (!resolvedUploadId && resumeFromState) {
      const savedState =
        UploadStateManager.findMatchingUploadState({
          projectId,
          fileType: type,
          fileHash,
          buildingName: resolvedBuildingName,
          floorName: resolvedFloorName,
          producedAt: resolvedProducedAt,
        }) || UploadStateManager.getUploadStateByHash(fileHash)
      if (
        savedState &&
        savedState.projectId === projectId &&
        savedState.fileType === type
      ) {
        resolvedUploadId = savedState.uploadId
        if (!resolvedProducedAt) {
          resolvedProducedAt = savedState.producedAt
        }
        if (!resolvedBuildingName) {
          resolvedBuildingName = savedState.buildingName
        }
        if (!resolvedFloorName) {
          resolvedFloorName = savedState.floorName
        }
        logger.info(`从本地状态恢复 uploadId: ${resolvedUploadId}`)
      }
    }

    if (type === 'scan' && !resolvedUploadId && !resolvedProducedAt) {
      throw new Error('扫描数据需填写扫描日期')
    }
    const { uploadId, uploadStatus } = await initializeUpload({
      projectId,
      file,
      fileHash,
      buildingName: resolvedBuildingName,
      floorName: resolvedFloorName,
      type,
      producedAt: resolvedProducedAt,
      existingUploadId: resolvedUploadId,
      ingestMode,
      componentType,
      archiveSerial,
      archiveCode,
    })

    logger.info(
      `uploadId: ${uploadId}, 总分片: ${uploadStatus.totalChunks}, 已上传: ${uploadStatus.uploadedChunks?.length || 0}`,
    )

    // 通知上传 ID 已创建
    onUploadIdCreated?.(uploadId)

    // 保存上传状态
    saveUploadProgress(
      uploadId,
      file,
      fileHash,
      type,
      projectId,
      uploadStatus,
      resolvedBuildingName ?? uploadStatus.buildingName ?? undefined,
      resolvedProducedAt,
      description,
      resolvedFloorName ?? uploadStatus.floorName ?? undefined,
      ingestMode,
      trajectoryUploadId,
      componentType,
      archiveSerial,
      archiveCode,
    )

    // 3. 检查是否为秒传
    if (isInstantUpload(uploadStatus)) {
      logger.info('检测到秒传，直接完成上传')
      onPhaseChange?.('merging')
      return await completeFileUpload(uploadId, fileHash, onProgress, {
        trajectoryUploadId,
      })
    }

    // 4. 上传分片（断点续传）
    return await resumeChunkUpload({
      uploadId,
      file,
      fileHash,
      chunkSize: uploadStatus.chunkSize,
      totalChunks: uploadStatus.totalChunks,
      uploadedChunks: uploadStatus.uploadedChunks || [],
      onProgress,
      onChunkProgress,
      onCancelCheck,
      projectId,
      type,
      description,
      onPhaseChange,
      trajectoryUploadId,
    })
  } catch (error: any) {
    throw handleUploadError(error)
  }
}

/**
 * 恢复分片上传参数
 */
interface ResumeChunkUploadParams {
  uploadId: number
  file: File
  fileHash: string
  chunkSize: number
  totalChunks: number
  uploadedChunks: number[]
  onProgress?: (progress: number) => void
  onChunkProgress?: (state: ChunkProgressState) => void
  onCancelCheck?: () => boolean
  projectId: number
  type: FileType
  description?: string
  onPhaseChange?: (phase: UploadPhase) => void
  trajectoryUploadId?: number
}

/**
 * 恢复分片上传
 */
const resumeChunkUpload = async (
  params: ResumeChunkUploadParams,
): Promise<ProjectFile> => {
  const {
    uploadId,
    file,
    fileHash,
    chunkSize,
    totalChunks,
    uploadedChunks,
    onProgress,
    onChunkProgress,
    onCancelCheck,
    onPhaseChange,
    trajectoryUploadId,
  } = params

  try {
    const uploadedChunksSet = new Set(uploadedChunks)
    let completedChunks = uploadedChunksSet.size
    let activeChunks = 0
    let failedChunks = 0
    const pendingChunkIndexes = Array.from(
      { length: totalChunks },
      (_, index) => index,
    ).filter((chunkIndex) => !uploadedChunksSet.has(chunkIndex))
    const concurrency = resolveUploadConcurrency(pendingChunkIndexes.length)
    let nextPendingIndex = 0
    let uploadError: unknown = null

    logger.info(`开始上传分片，已完成 ${completedChunks}/${totalChunks}`)
    onPhaseChange?.('uploading')
    emitChunkProgress(
      completedChunks,
      totalChunks,
      activeChunks,
      failedChunks,
      onProgress,
      onChunkProgress,
    )

    const uploadSingleChunk = async (chunkIndex: number) => {
      if (onCancelCheck?.()) {
        throw new Error('上传已取消')
      }
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunkData = file.slice(start, end)
      logger.info(
        `上传分片 ${chunkIndex + 1}/${totalChunks}, 大小: ${(chunkData.size / 1024).toFixed(2)}KB`,
      )
      const chunkResult = await uploadFileChunk(uploadId, chunkIndex, chunkData)
      if (!isSuccessResponse(chunkResult.code)) {
        throw new Error(`分片 ${chunkIndex} 上传失败: ${chunkResult.msg}`)
      }
      completedChunks++
      uploadedChunksSet.add(chunkIndex)
      UploadStateManager.updateProgress(
        uploadId,
        calcProgress(completedChunks, totalChunks),
        Array.from(uploadedChunksSet),
      )
    }

    const runWorker = async () => {
      while (nextPendingIndex < pendingChunkIndexes.length) {
        if (uploadError) return
        if (onCancelCheck?.()) {
          uploadError = new Error('上传已取消')
          return
        }

        const chunkIndex = pendingChunkIndexes[nextPendingIndex]
        nextPendingIndex += 1
        activeChunks += 1
        emitChunkProgress(
          completedChunks,
          totalChunks,
          activeChunks,
          failedChunks,
          onProgress,
          onChunkProgress,
        )

        try {
          await uploadSingleChunk(chunkIndex)
        } catch (error) {
          failedChunks = 1
          uploadError = error
        } finally {
          activeChunks = Math.max(activeChunks - 1, 0)
          emitChunkProgress(
            completedChunks,
            totalChunks,
            activeChunks,
            failedChunks,
            onProgress,
            onChunkProgress,
          )
        }
      }
    }

    if (pendingChunkIndexes.length > 0) {
      await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
    }

    if (uploadError) {
      throw uploadError
    }

    // 完成上传
    logger.info('所有分片上传完成，开始合并文件...')
    onPhaseChange?.('merging')
    return await completeFileUpload(uploadId, fileHash, onProgress, {
      trajectoryUploadId,
    })
  } catch (error: any) {
    logger.error('分片上传失败:', error)
    // 保留状态以便用户重试
    if (error.message === '上传已取消') {
      logger.info('上传已取消，状态已保存')
    }
    throw error
  }
}

/**
 * 计算上传进度百分比 (10% ~ 90%)
 */
const calcProgress = (completedChunks: number, totalChunks: number): number => {
  return 10 + Math.floor((completedChunks / totalChunks) * 80)
}

/**
 * 更新分片上传进度
 */
const emitChunkProgress = (
  completedChunks: number,
  totalChunks: number,
  activeChunks: number,
  failedChunks: number,
  onProgress?: (progress: number) => void,
  onChunkProgress?: (state: ChunkProgressState) => void,
): void => {
  const progress = calcProgress(completedChunks, totalChunks)
  onProgress?.(progress)
  onChunkProgress?.({
    completed: completedChunks,
    total: totalChunks,
    active: activeChunks,
    failed: failedChunks,
  })
}

/**
 * 取消文件上传
 */
export const cancelFileUpload = async (uploadId: number): Promise<void> => {
  try {
    await cancelUpload(uploadId)
  } catch (error) {
    console.error('取消上传失败:', error)
    throw error
  }
}

/**
 * 获取上传状态
 */
export const getFileUploadStatus = async (
  uploadId: number,
): Promise<UploadStatus> => {
  try {
    const result = await getUploadStatus(uploadId)
    if (!isSuccessResponse(result.code)) {
      throw new Error(result.msg || '获取上传状态失败')
    }
    return result.data
  } catch (error) {
    console.error('获取上传状态失败:', error)
    throw error
  }
}

/**
 * 文件类型映射（UI 显示 -> API 类型）
 */
export const fileTypeMap: Record<string, FileType> = {
  BIM: 'bim',
  CAD: 'cad',
  点云: 'scan',
  高斯模型: 'gauss',
  gauss: 'gauss',
  CSV: 'scan', // CSV 轨迹数据归类为 scan
}

/**
 * 转换文件类型（从 UI 显示类型转换为 API 类型）
 */
export const convertFileType = (uiType: string): FileType => {
  return fileTypeMap[uiType] || 'scan'
}

/**
 * FileUploader 类配置选项
 */
export interface FileUploaderOptions {
  buildingName?: string
  projectId: number
  type: FileType
  file: File
  floorName?: string
  producedAt?: string
  existingUploadId?: number
  existingFileHash?: string
  onProgress?: (progress: number) => void
  onChunkProgress?: (state: ChunkProgressState) => void
  onHashProgress?: (progress: number) => void
  onPhaseChange?: (phase: UploadPhase) => void
  onSuccess?: (fileInfo: ProjectFile) => void
  onError?: (error: Error) => void
  description?: string
  resumeFromState?: boolean // 是否从保存的状态恢复
  /** 点云入库方式（仅 type=scan）。 */
  ingestMode?: ScanIngestMode
  /** 后处理点云完成时关联的轨迹上传会话 ID。 */
  trajectoryUploadId?: number
  /** 归档信息。 */
  componentType?: string
  archiveSerial?: string
  archiveCode?: string
}

/**
 * FileUploader 类 - 封装文件上传逻辑
 */
export class FileUploader {
  private options: FileUploaderOptions
  private uploadId?: number
  private fileHash?: string
  private isUploading = false
  private shouldCancel = false

  constructor(options: FileUploaderOptions) {
    this.options = options
    this.uploadId = options.existingUploadId
    this.fileHash = options.existingFileHash
  }

  /**
   * 开始上传
   */
  async start(): Promise<void> {
    if (this.isUploading) {
      throw new Error('文件正在上传中')
    }

    this.isUploading = true
    this.shouldCancel = false

    try {
      const result = await uploadFile({
        projectId: this.options.projectId,
        type: this.options.type,
        file: this.options.file,
        buildingName: this.options.buildingName,
        floorName: this.options.floorName,
        producedAt: this.options.producedAt,
        onProgress: this.options.onProgress,
        onChunkProgress: this.options.onChunkProgress,
        onHashProgress: this.options.onHashProgress,
        onPhaseChange: this.options.onPhaseChange,
        onHashResolved: (hash) => {
          this.fileHash = hash
        },
        onUploadIdCreated: (uploadId) => {
          this.uploadId = uploadId
        },
        onCancelCheck: () => this.shouldCancel,
        description: this.options.description,
        resumeFromState: this.options.resumeFromState,
        existingUploadId: this.options.existingUploadId,
        existingFileHash: this.fileHash,
        ingestMode: this.options.ingestMode,
        trajectoryUploadId: this.options.trajectoryUploadId,
        componentType: this.options.componentType,
        archiveSerial: this.options.archiveSerial,
        archiveCode: this.options.archiveCode,
      })

      if (!this.shouldCancel) {
        this.options.onSuccess?.(result)
      }
    } catch (error: any) {
      if (this.shouldCancel) {
        return
      }
      this.options.onError?.(error)
      throw error
    } finally {
      this.isUploading = false
      this.shouldCancel = false
    }
  }

  /**
   * 暂停上传（断点续传）
   */
  pause(): void {
    if (this.isUploading) {
      this.shouldCancel = true
      this.isUploading = false
      logger.info('上传已暂停，uploadId:', this.uploadId)
    }
  }

  /**
   * 继续上传（从暂停状态恢复）
   */
  async resume(): Promise<void> {
    if (this.isUploading) {
      throw new Error('文件正在上传中')
    }

    if (!this.uploadId) {
      throw new Error('没有有效的上传任务')
    }

    this.isUploading = true
    this.shouldCancel = false

    try {
      // 获取当前上传状态
      const statusResult = await getUploadStatus(this.uploadId)
      if (!isSuccessResponse(statusResult.code)) {
        throw new Error(statusResult.msg || '获取上传状态失败')
      }

      const uploadStatus: UploadStatus = statusResult.data
      logger.info(
        `继续上传，当前进度: ${uploadStatus.uploadedChunks?.length || 0}/${uploadStatus.totalChunks}`,
      )

      // 继续上传剩余分片
      const result = await resumeChunkUpload({
        uploadId: this.uploadId,
        file: this.options.file,
        fileHash: this.fileHash || '',
        chunkSize: uploadStatus.chunkSize,
        totalChunks: uploadStatus.totalChunks,
        uploadedChunks: uploadStatus.uploadedChunks || [],
        onProgress: this.options.onProgress,
        onChunkProgress: this.options.onChunkProgress,
        onCancelCheck: () => this.shouldCancel,
        projectId: this.options.projectId,
        type: this.options.type,
        description: this.options.description,
        onPhaseChange: this.options.onPhaseChange,
        trajectoryUploadId: this.options.trajectoryUploadId,
      })

      if (!this.shouldCancel) {
        this.options.onSuccess?.(result)
      }
    } catch (error: any) {
      if (this.shouldCancel) {
        return
      }
      this.options.onError?.(error)
      throw error
    } finally {
      this.isUploading = false
      this.shouldCancel = false
    }
  }

  /**
   * 取消上传
   */
  async cancel(): Promise<void> {
    if (this.isUploading) {
      this.shouldCancel = true

      if (this.uploadId) {
        try {
          await cancelFileUpload(this.uploadId)
        } catch (error) {
          logger.error('取消上传失败:', error)
        }
      }

      this.isUploading = false
    }
  }

  /**
   * 获取上传状态
   */
  getUploadingStatus(): boolean {
    return this.isUploading
  }

  /**
   * 获取 uploadId
   */
  getUploadId(): number | undefined {
    return this.uploadId
  }
}
