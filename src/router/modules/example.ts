/**
 * 高斯模型路由模块
 */

export default {
  path: '/example',
  name: 'Example',
  redirect: '/example/model',
  meta: {
    // 页面标题
    title: '模型融合',
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
      path: '/example/model',
      name: 'ExampleModel',
      component: () => import('@/views/example/index.vue'),
      meta: {
        // 页面标题
        title: '模型融合',
        // 图标
        icon: 'ep/coordinate',
        // 是否显示在菜单中
        showLink: false,
        // 全屏页面，不显示侧边栏
        fullPage: true,
      },
    },
  ],
}
