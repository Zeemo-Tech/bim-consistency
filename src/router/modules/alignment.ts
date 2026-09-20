/**
 * 高斯模型路由模块
 */

export default {
  path: '/alignment',
  name: 'Alignment',
  redirect: '/alignment/model',
  meta: {
    // 页面标题
    title: 'BIM-点云校准',
    // 图标
    icon: 'ep/coordinate',
    // 菜单排序
    rank: 9,
    // 在侧边栏显示
    showLink: false,
    // 全屏页面，不显示侧边栏
    fullPage: true,
  },
  children: [
    {
      path: '/alignment/model',
      name: 'AlignmentModel',
      component: () => import('@/views/BimPointcloudAlign/index.vue'),
      meta: {
        // 页面标题
        title: 'BIM-点云校准',
        // 图标
        icon: 'ep/coordinate',
        // 是否显示在菜单中
        showLink: true,
        // 全屏页面，不显示侧边栏
        fullPage: true,
      },
    },
  ],
}
