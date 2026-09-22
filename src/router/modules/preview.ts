/**
 * 文件预览路由模块
 *
 * 提供独立的文件预览功能，支持预览BIM模型、CAD图纸、点云文件等
 */

export default {
  path: '/preview/:id',
  name: 'PreviewFile',
  component: () => import('@/views/preview/index.vue'),
  meta: {
    title: '文件预览',
    icon: 'ep/view',
    showLink: false, // 不在菜单中显示
    hideMenu: true, // 隐藏菜单
    fullPage: true // 全屏页面，隐藏侧边栏/顶部栏/标签页
  }
}