/**
 * LCC Web SDK TypeScript 声明文件
 * LCC Web SDK for 3D Gaussian Splatting
 */

declare module '@/libs/lcc-0.5.4.js' {
  import type * as THREE from 'three'

  export interface LCCLoadParams {
    /** 相机对象 */
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    /** 场景对象 */
    scene: THREE.Scene
    /** 渲染库 (THREE.js) */
    renderLib: typeof THREE
    /** 渲染器 */
    renderer: THREE.WebGLRenderer
    /** Canvas 画布 */
    canvas: HTMLCanvasElement
    /** 数据路径 */
    dataPath: string | Record<string, { url: string; header?: Record<string, string> }>
    /** 是否使用环境数据，默认 false */
    useEnv?: boolean
    /** 是否使用 IndexDB 缓存，默认 true */
    useIndexDB?: boolean
    /** 是否使用加载特效，默认 false */
    useLoadingEffect?: boolean
    /** 加载特效中心位置 */
    loadingEffectCenter?: { x: number; y: number; z: number }
    /** 点云颜色模式: 'default' | 'rainbow' */
    pointsColor?: 'default' | 'rainbow'
    /** AppKey 用于去除水印 */
    appKey?: string | null
    /** 模型矩阵 */
    modelMatrix?: THREE.Matrix4
    /** Host 缓存大小 */
    maxHostCacheSize?: number
    /** GPU 缓存大小 */
    maxGpuCacheSize?: number
  }

  export interface LCCObject {
    /** 切换点云显示模式 */
    togglePointsDisplayMode(): void
    /** 设置是否使用环境数据 */
    useEnvironment(value: boolean): void
    /** 设置是否使用球谐渲染 */
    useShcoef(value: boolean): void
    /** 射线检测 */
    raycast?(raycaster: THREE.Raycaster): void
  }

  export class LCCRender {
    /**
     * 加载 LCC 数据
     * @param params 加载参数
     * @param successCallback 成功回调
     * @param loadingCallback 加载进度回调
     * @param failureCallback 失败回调
     * @returns LCC 对象
     */
    static load(
      params: LCCLoadParams,
      successCallback?: (mesh: THREE.Mesh) => void,
      loadingCallback?: (percent: number) => void,
      failureCallback?: () => void
    ): LCCObject

    /**
     * 卸载 LCC 模型
     * @param object LCC 对象
     */
    static unload(object: LCCObject): void

    /**
     * 更新 LCC 渲染（仅 Three.js 引擎使用）
     */
    static update(): void

    /**
     * 更新相机（仅 Three.js 引擎使用）
     * @param camera 相机对象
     */
    static setCamera(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void
  }
}
