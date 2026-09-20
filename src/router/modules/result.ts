/**
 * 校准结果路由模块
 */

const Layout = () => import('@/layout/index.vue')

export default {
  path: '/result',
  name: 'Result',
  component: Layout,
  redirect: '/result/index',
  meta: {
    // 页面标题
    title: '校准结果',
    // 图标
    icon: 'ep/trophy',
    // 菜单排序
    rank: 9,
    // 在侧边栏显示
    showLink: false,
  },
  children: [
    {
      path: '/result/index',
      name: 'ResultIndex',
      component: () => import('@/views/result/index.vue'),
      meta: {
        // 页面标题
        title: '校准结果',
        // 图标
        icon: 'ep/trophy',
        // 是否显示在菜单中
        showLink: true,
      },
    },
  ],
}
