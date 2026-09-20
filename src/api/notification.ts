import { http } from '@/utils/http'

export interface Result<T = any> {
  code: number
  data: T
  msg: string
}

export interface PageData<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

export type NotificationType = 'annotation_invite' | 'system_announcement'

export type NotificationBox = 'inbox' | 'sent'

export type NotificationSource = 'manual' | 'system'
export type NotificationStatus = 'unread' | 'read' | 'done'

export interface NotificationUser {
  userId: number
  name: string
  email?: string
}

export interface NotificationRecipient extends NotificationUser {
  status: NotificationStatus
  statusChangedAt: string | null
}

export interface NotificationPayloadEnvelope<TData = Record<string, any>> {
  schemaVersion: number
  data: TData
}

export interface NotificationListItem {
  id: number
  type: NotificationType
  source: NotificationSource
  title: string
  content: string
  createdAt: string
  sender: NotificationUser
  status?: NotificationStatus
}

export interface NotificationDetail extends NotificationListItem {
  recipients: NotificationRecipient[]
  payload: NotificationPayloadEnvelope
}

export interface NotificationListQuery {
  page?: number
  pageSize?: number
  box?: NotificationBox
  type?: NotificationType
  keyword?: string
  status?: NotificationStatus
}

export interface CreateNotificationPayload {
  type: NotificationType
  title: string
  content: string
  recipientUserIds: number[]
  payload: NotificationPayloadEnvelope
}

export interface ProjectMemberItem {
  id: number
  userId: number
  username: string
  displayName: string
  email: string
  phone: string
  roleName: string
}

export const getNotificationTypeLabel = (type: NotificationType) => {
  if (type === 'system_announcement') return '系统公告'
  return '批注邀请'
}

export const getNotificationStatusLabel = (status?: NotificationStatus) => {
  if (status === 'done') return '已完成'
  if (status === 'read') return '已读'
  return '未读'
}

export const getNotificationStatusTagType = (status?: NotificationStatus) => {
  if (status === 'done') return 'success'
  if (status === 'read') return 'info'
  return 'primary'
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

export const formatNotificationTime = (value: string) => {
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return value
  const diff = Date.now() - target
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}分钟前`
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))}小时前`
  }
  if (diff < 2 * 24 * 60 * 60 * 1000) return '昨天'
  return formatDateTime(value)
}

export const createNotification = (data: CreateNotificationPayload) => {
  return http.request<Result<NotificationDetail>>('post', '/api/notifications', {
    data,
  })
}

export const getNotificationList = (params?: NotificationListQuery) => {
  return http.request<Result<PageData<NotificationListItem>>>(
    'get',
    '/api/notifications',
    {
      params,
    },
  )
}

export const getNotificationUnreadCount = () => {
  return http.request<Result<{ unreadCount: number }>>(
    'get',
    '/api/notifications/unread-count',
  )
}

export const updateNotificationStatus = (
  notificationId: number,
  status: Extract<NotificationStatus, 'read' | 'done'>,
) => {
  return http.request<Result<boolean>>(
    'patch',
    `/api/notifications/${notificationId}/status`,
    {
      data: { status },
    },
  )
}

export const markAllNotificationsAsRead = () => {
  return http.request<Result<boolean>>('patch', '/api/notifications/status/all', {
    data: { status: 'read' },
  })
}

export const getNotificationDetail = (notificationId: number) => {
  return http.request<Result<NotificationDetail>>(
    'get',
    `/api/notifications/${notificationId}`,
  )
}

export const getProjectMembersForPicker = (
  projectId: number,
  params?: { page?: number; pageSize?: number; keyword?: string },
): Promise<Result<PageData<ProjectMemberItem>>> => {
  return http.request<Result<PageData<ProjectMemberItem>>>(
    'get',
    `/api/projects/${projectId}/members`,
    {
      params,
    },
  )
}
