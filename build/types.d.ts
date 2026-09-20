/** 通用对象类型 */
type Recordable<T = any> = Record<string, T>

/** Vite 压缩配置类型 */
type ViteCompression =
  | 'none'
  | 'gzip'
  | 'brotli'
  | 'both'
  | 'gzip-clear'
  | 'brotli-clear'
  | 'both-clear'

/** Vite 环境变量类型 */
interface ViteEnv {
  VITE_PORT: number
  VITE_PUBLIC_PATH: string
  VITE_ROUTER_HISTORY: string
  VITE_CDN: boolean
  VITE_HIDE_HOME: string
  VITE_COMPRESSION: ViteCompression
  [key: string]: any
}
