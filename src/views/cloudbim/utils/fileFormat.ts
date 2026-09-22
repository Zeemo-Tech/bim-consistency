import type { FileStatus, MeshRemeshStatus } from '@/api/fileManage'

export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

export function formatFileSize(size: number): string {
  if (!size) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(size) / Math.log(k))
  return `${Number.parseFloat((size / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`
}

export function formatDate(value?: string | number): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '-')
}

const statusTextMap: Record<string, string> = {
  stored: '已上传',
  processing: '处理中',
  completed: '已完成',
  failed: '上传失败',
  pending_chunks: '待续传',
  pending_external: '上传中',
  queued: '排队中',
  failed_external: '上传失败',
}

const statusTagMap: Record<string, TagType> = {
  stored: 'success',
  processing: 'primary',
  completed: 'success',
  failed: 'danger',
  pending_chunks: 'warning',
  pending_external: 'warning',
  queued: 'warning',
  failed_external: 'danger',
}

export function statusText(status?: FileStatus | string): string {
  return statusTextMap[status || ''] || status || '状态未知'
}

export function statusTagType(status?: FileStatus | string): TagType {
  return statusTagMap[status || ''] || 'info'
}

const meshRemeshTextMap: Record<string, string> = {
  queued: '均匀化排队中',
  processing: '均匀化处理中',
  succeeded: '均匀化已完成',
  failed: '均匀化失败',
  idle: '未均匀化',
}

const meshRemeshTagMap: Record<string, TagType> = {
  queued: 'warning',
  processing: 'primary',
  succeeded: 'success',
  failed: 'danger',
  idle: 'info',
}

export function meshRemeshText(status?: MeshRemeshStatus): string {
  return meshRemeshTextMap[status || 'idle'] || '未均匀化'
}

export function meshRemeshTagType(status?: MeshRemeshStatus): TagType {
  return meshRemeshTagMap[status || 'idle'] || 'info'
}
