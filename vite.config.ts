import { getPluginsList } from './build/plugins'
import { include, exclude } from './build/optimize'
import { type UserConfigExport, type ConfigEnv, loadEnv } from 'vite'
import {
  root,
  alias,
  wrapperEnv,
  pathResolve,
  __APP_INFO__,
} from './build/utils'
import fs from 'fs'
import path from 'path'

export default ({ mode }: ConfigEnv): UserConfigExport => {
  const { VITE_CDN, VITE_PORT, VITE_COMPRESSION, VITE_PUBLIC_PATH, VITE_API_BASE_URL } =
    wrapperEnv(loadEnv(mode, root))
  return {
    base: VITE_PUBLIC_PATH,
    root,
    resolve: {
      alias,
    },
    // 服务端渲染
    server: {
      port: VITE_PORT,
      host: '0.0.0.0',
      open: false,
      // 自签名证书，使 https://10.0.0.4:8848 成为安全上下文，WebGPU 可用
      https: (() => {
        const certDir = path.resolve(__dirname, '.cert')
        const keyFile = path.join(certDir, 'key.pem')
        const certFile = path.join(certDir, 'cert.pem')
        if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
          return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }
        }
        return undefined
      })(),
      // 本地跨域代理 https://cn.vitejs.dev/config/server-options.html#server-proxy
      proxy: {
        // 代理所有 /api 开头的请求到后端服务器
        '/api': {
          target: VITE_API_BASE_URL,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          timeout: 1800000,
          proxyTimeout: 1800000,
        },
        '/uploads': {
          target: VITE_API_BASE_URL,
          changeOrigin: true,
        },
        '/tiles': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tiles/, ''),
        },
      },
      // 预热文件以提前转换和缓存结果，降低启动期间的初始页面加载时长并防止转换瀑布
      warmup: {
        clientFiles: ['./index.html', './src/{views,components}/*'],
      },
      // 配置 HMR
      hmr: {
        overlay: true,
      },
    },
    plugins: getPluginsList(VITE_CDN, VITE_COMPRESSION),
    // https://cn.vitejs.dev/config/dep-optimization-options.html#dep-optimization-options
    optimizeDeps: {
      include,
      exclude,
    },
    build: {
      // https://cn.vitejs.dev/guide/build.html#browser-compatibility
      // LCC SDK creates Blob workers from function.toString(); lowering private
      // fields to es2015 injects external helpers that are unavailable in workers.
      target: 'es2022',
      sourcemap: false,
      // 消除打包大小超过500kb警告
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        input: {
          index: pathResolve('./index.html', import.meta.url),
        },
        // 静态资源分类打包
        output: {
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
          // 分块策略
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            element: ['element-plus'],
            echarts: ['echarts'],
          },
        },
      },
      // 压缩选项
      minify: 'esbuild',
    },
    // esbuild 压缩配置
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    define: {
      __INTLIFY_PROD_DEVTOOLS__: false,
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
  }
}
