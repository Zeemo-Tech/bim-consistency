import {
  getAnnotationScreenshotBlob,
  getAnnotationScreenshots,
} from '@/api/annotation'

/**
 * 批注截图解析缓存：
 * - 同一批注入参只拉取一次截图列表与图片（并发去重 + 结果缓存）；
 * - 优先使用后端下发的可直接加载的绝对地址（http/blob/data），零额外请求；
 * - 否则按需下载带鉴权的 blob 并缓存 objectURL，重复打开不再请求；
 * - 超出容量按插入顺序淘汰并释放 objectURL，控制内存。
 */

export interface AnnotationScreenshotLike {
  id?: number
  fileId?: number
  url?: string
  sortOrder?: number
}

const MAX_CACHE_ENTRIES = 80

const listCache = new Map<string, AnnotationScreenshotLike[]>()
const urlCache = new Map<string, string[]>()
const inflight = new Map<string, Promise<string[]>>()

const keyOf = (projectId: number, scanFileId: number, annotationId: number) =>
  `${projectId}:${scanFileId}:${annotationId}`

const toDisplayUrl = (raw?: string) => {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (
    /^https?:\/\//i.test(url) ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  )
    return url
  if (url.startsWith('/api/')) return url
  return url.startsWith('/') ? `/api${url}` : `/api/${url}`
}

const isDirectlyLoadable = (url: string) =>
  /^https?:\/\//i.test(url) ||
  url.startsWith('blob:') ||
  url.startsWith('data:')

const releaseUrls = (key: string) => {
  const urls = urlCache.get(key)
  if (urls) {
    urls.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    })
  }
  urlCache.delete(key)
  listCache.delete(key)
}

const evictIfNeeded = () => {
  while (urlCache.size > MAX_CACHE_ENTRIES) {
    const oldest = urlCache.keys().next().value as string | undefined
    if (!oldest) break
    releaseUrls(oldest)
  }
}

async function fetchScreenshotList(
  projectId: number,
  scanFileId: number,
  annotationId: number,
): Promise<AnnotationScreenshotLike[]> {
  const key = keyOf(projectId, scanFileId, annotationId)
  const cached = listCache.get(key)
  if (cached) return cached
  const res = await getAnnotationScreenshots(
    projectId,
    scanFileId,
    annotationId,
  )
  const list = [...(res.data ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  ) as AnnotationScreenshotLike[]
  listCache.set(key, list)
  return list
}

/** 已缓存则可同步取到展示地址（用于首屏秒开）。 */
export function peekAnnotationScreenshotUrls(
  projectId: number,
  scanFileId: number,
  annotationId: number,
): string[] | undefined {
  return urlCache.get(keyOf(projectId, scanFileId, annotationId))
}

/** 解析批注截图的展示地址（带缓存与并发去重）。 */
export function resolveAnnotationScreenshotUrls(
  projectId: number,
  scanFileId: number,
  annotationId: number,
  inline?: AnnotationScreenshotLike[],
): Promise<string[]> {
  if (!projectId || !scanFileId || !annotationId) return Promise.resolve([])
  const key = keyOf(projectId, scanFileId, annotationId)
  const cached = urlCache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const list =
      inline && inline.length
        ? inline
        : await fetchScreenshotList(projectId, scanFileId, annotationId)
    // 并行下载（Promise.all 保序），避免逐张串行等待
    const resolved = await Promise.all(
      list.map(async (shot) => {
        const display = toDisplayUrl(shot.url)
        if (isDirectlyLoadable(display)) return display
        const id = Number(shot.id) || Number(shot.fileId)
        if (id) {
          try {
            const blob = await getAnnotationScreenshotBlob(
              projectId,
              scanFileId,
              annotationId,
              id,
            )
            return URL.createObjectURL(blob)
          } catch {
            /* 落到相对地址兜底 */
          }
        }
        return display
      }),
    )
    const urls = resolved.filter(Boolean)
    urlCache.set(key, urls)
    evictIfNeeded()
    return urls
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, task)
  return task
}

/** 清空缓存并释放 objectURL。 */
export function clearAnnotationScreenshotCache() {
  ;[...urlCache.keys()].forEach(releaseUrls)
  inflight.clear()
  listCache.clear()
}
