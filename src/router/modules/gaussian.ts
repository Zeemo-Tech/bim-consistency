/**
 * 高斯模型路由模块
 */

const Layout = () => import('@/layout/index.vue')

export default {
  path: '/gaussian',
  name: 'Gaussian',
  component: Layout,
  redirect: '/gaussian/model',
  meta: {
    // 页面标题
    title: '高斯模型',
    // 图标
    icon: 'ep/coordinate',
    // 菜单排序
    rank: 4,
    // 在侧边栏显示
    showLink: false,
  },
  children: [
    {
      path: '/gaussian/model',
      name: 'GaussianModel',
      component: () => import('@/views/gaussian/index.vue'),
      meta: {
        // 页面标题
        title: '高斯模型',
        // 图标
        icon: 'ep/coordinate',
        // 是否显示在菜单中
        showLink: true,
      },
    },
  ],
}
