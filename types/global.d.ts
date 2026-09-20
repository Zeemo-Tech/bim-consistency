/// <reference types="vite/client" />

declare global {
  /**
   * 平台配置
   */
  interface PlatformConfigs {
    Version?: string
    Title?: string
    FixedHeader?: boolean
    HiddenSideBar?: boolean
    MultiTagsCache?: boolean
    KeepAlive?: boolean
    Locale?: string
    Layout?: string
    Theme?: string
    DarkMode?: boolean
    OverallStyle?: string
    Grey?: boolean
    Weak?: boolean
    HideTabs?: boolean
    HideFooter?: boolean
    Stretch?: boolean
    SidebarStatus?: boolean
    EpThemeColor?: string
    ShowLogo?: boolean
    ShowModel?: string
    MenuArrowIconNoTransition?: boolean
    CachingAsyncRoutes?: boolean
    TooltipEffect?: string
    ResponsiveStorageNameSpace?: string
    MenuSearchHistory?: number
  }

  /**
   * 存储配置
   */
  interface StorageConfigs {
    version?: string
    title?: string
    fixedHeader?: boolean
    hiddenSideBar?: boolean
    multiTagsCache?: boolean
    keepAlive?: boolean
    locale?: string
    layout?: string
    theme?: string
    darkMode?: boolean
    grey?: boolean
    weak?: boolean
    hideTabs?: boolean
    hideFooter?: boolean
    stretch?: boolean
    sidebarStatus?: boolean
    epThemeColor?: string
    showLogo?: boolean
    showModel?: string
  }

  /**
   * 构建信息
   */
  const __APP_INFO__: {
    pkg: {
      name: string
      version: string
      engines: {
        node: string
        pnpm: string
      }
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    lastBuildTime: string
  }

  /**
   * 路由组件类型
   */
  interface RouteComponent {
    path?: string
    name?: string
    redirect?: string
    component?: any
    meta?: {
      title?: string
      icon?: string
      showLink?: boolean
      rank?: number
      roles?: string[]
      auths?: string[]
      keepAlive?: boolean
      frameSrc?: string
      frameLoading?: boolean
      transition?: {
        enterTransition?: string
        leaveTransition?: string
      }
      hiddenTag?: boolean
      dynamicLevel?: number
      fixedTag?: boolean
      [key: string]: any
    }
    children?: RouteComponent[]
    parentId?: number
    pathList?: number[]
    backstage?: boolean
  }

  /**
   * 路由配置表类型
   */
  type RouteConfigsTable = {
    path: string
    name?: string
    component?: any
    redirect?: string
    parentId?: number
    meta?: {
      title?: string
      icon?: string
      showLink?: boolean
      rank?: number
    }
    children?: RouteConfigsTable[]
  }

  /**
   * ToRouteType
   */
  interface ToRouteType {
    path: string
    name?: string | symbol
    fullPath: string
    matched: any[]
    meta: {
      loaded?: boolean
      title?: string
      keepAlive?: boolean
      frameSrc?: string
      [key: string]: any
    }
    [key: string]: any
  }

  /**
   * HTML 元素扩展（用于自定义指令）
   */
  interface HTMLElement {
    _ripple?: any
  }

  /**
   * JSX 命名空间（用于 propTypes）
   */
  namespace JSX {
    interface IntrinsicElements {
      [elem: string]: any
    }
    interface Element {
      [key: string]: any
    }
  }
}

/**
 * Vue 实例扩展
 */
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $storage: {
      locale?: {
        locale?: string
        [key: string]: any
      }
      [key: string]: any
    }
  }
}

/**
 * Options API 支持
 */
declare module 'vue' {
  interface ComponentCustomProperties {
    $storage: {
      locale?: {
        locale?: string
        [key: string]: any
      }
      [key: string]: any
    }
  }
}

export {}
