/**
 * Web Worker for calculating file hash using SparkMD5
 * 使用 Web Worker 计算文件 hash，避免阻塞主线程
 */
import SparkMD5 from 'spark-md5'

/** Worker 消息类型 */
interface WorkerMessage {
  file: File
  chunkSize?: number
}

/** Worker 响应类型 */
interface WorkerResponse {
  type: 'progress' | 'success' | 'error'
  progress?: number
  hash?: string
  error?: string
}

/** 默认分片大小：2MB */
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024

/**
 * 大文件快速指纹阈值：16MB。
 * 高斯 / 归档 zip 动辄几百 MB，整包读取会触发 Chrome 浏览器进程读大 Blob 的崩溃
 * （线程池前台 worker SIGTRAP）。因此只要文件偏大就改用「采样指纹」，
 * 只读少量头 / 尾 / 均匀分布的分片，不再整包读取。
 */
const SPARSE_HASH_THRESHOLD = 16 * 1024 * 1024

/** 大文件快速指纹最多读取 8MB */
const SPARSE_HASH_BUDGET = 8 * 1024 * 1024

/** 最小分片大小：512KB */
const MIN_CHUNK_SIZE = 512 * 1024

/** 最大分片大小：10MB */
const MAX_CHUNK_SIZE = 10 * 1024 * 1024

/**
 * 验证并规范化分片大小
 */
const normalizeChunkSize = (chunkSize: number): number => {
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, chunkSize))
}

/**
 * 发送消息到主线程
 */
const postResponse = (response: WorkerResponse): void => {
  self.postMessage(response)
}

const buildSparsePlan = (fileSize: number, chunkSize: number) => {
  const sampleChunkSize = Math.min(chunkSize, 1024 * 1024)
  const sampleCount = Math.max(
    3,
    Math.min(8, Math.ceil(SPARSE_HASH_BUDGET / sampleChunkSize)),
  )
  const maxOffset = Math.max(fileSize - sampleChunkSize, 0)
  const offsets = new Set<number>([0, maxOffset])

  for (let index = 1; index < sampleCount - 1; index += 1) {
    const ratio = index / (sampleCount - 1)
    const offset = Math.floor(maxOffset * ratio)
    offsets.add(Math.max(0, Math.min(offset, maxOffset)))
  }

  return {
    sampleChunkSize,
    offsets: Array.from(offsets).sort((a, b) => a - b),
  }
}

// 监听主线程发送的消息
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { file, chunkSize = DEFAULT_CHUNK_SIZE } = e.data

  // 边界情况：空文件
  if (!file || file.size === 0) {
    postResponse({
      type: 'error',
      error: '文件为空或无效',
    })
    return
  }

  // 规范化分片大小
  const normalizedChunkSize = normalizeChunkSize(chunkSize)
  const totalChunks = Math.ceil(file.size / normalizedChunkSize)

  try {
    const spark = new SparkMD5.ArrayBuffer()

    if (file.size >= SPARSE_HASH_THRESHOLD) {
      const { sampleChunkSize, offsets } = buildSparsePlan(
        file.size,
        normalizedChunkSize,
      )

      for (let index = 0; index < offsets.length; index += 1) {
        const start = offsets[index]
        const end = Math.min(start + sampleChunkSize, file.size)
        const chunk = file.slice(start, end)
        const arrayBuffer = await chunk.arrayBuffer()
        spark.append(arrayBuffer)

        const positionMeta = new TextEncoder().encode(
          `:${start}:${end}:${file.size}:${sampleChunkSize}`,
        )
        spark.append(positionMeta.buffer)

        const progress = Math.floor(((index + 1) / offsets.length) * 100)
        postResponse({ type: 'progress', progress })
      }
    } else {
      // 小中型文件仍然走全量内容指纹，保持去重准确性
      for (let i = 0; i < totalChunks; i++) {
        const start = i * normalizedChunkSize
        const end = Math.min(start + normalizedChunkSize, file.size)
        const chunk = file.slice(start, end)
        const arrayBuffer = await chunk.arrayBuffer()
        spark.append(arrayBuffer)

        const progress = Math.floor(((i + 1) / totalChunks) * 100)
        postResponse({ type: 'progress', progress })
      }
    }

    const hash = spark.end()
    postResponse({ type: 'success', hash })
  } catch (error: any) {
    // 发送错误信息
    postResponse({
      type: 'error',
      error: error.message || '计算文件 hash 失败',
    })
  }
}

export {}
