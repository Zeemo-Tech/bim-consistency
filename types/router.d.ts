import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
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
    loaded?: boolean
    saveSrollTop?: boolean
    backstage?: boolean
    fixedTag?: boolean
    [key: string]: any
  }
}

export {}
