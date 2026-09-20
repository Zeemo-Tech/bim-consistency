/**
 * 二分屏路由模块 - BIM 二分屏查看器
 *
 * 提供同时查看 RVT 模型和 DWG 图纸的功能
 */

const Layout = () => import('@/layout/index.vue')

export default {
  path: '/twoScreen',
  name: 'TwoScreen',
  component: Layout,
  redirect: '/twoScreen/index',
  meta: {
    // 页面标题
    title: '二分屏',
    // 图标
    icon: 'ep/grid',
    // 菜单排序，值越高排的越后
    rank: 5,
    // 显示在菜单中
    showLink: false,
    // 全屏页面，不显示侧边栏
    fullPage: true,
  },
  children: [
    {
      path: '/twoScreen/index',
      name: 'TwoScreenIndex',
      component: () => import('@/views/twoScreen/index.vue'),
      meta: {
        title: '四分屏查看器',
        icon: 'ep/grid',
        showLink: true,
        // 全屏页面，不显示侧边栏
    fullPage: true,
      }
    }
  ]
}
