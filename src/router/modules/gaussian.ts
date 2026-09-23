/**
 * 高斯模型预览路由（全屏，隐藏侧边栏/顶部栏，与 BIM/点云预览一致）
 */

export default {
  path: '/gaussian/model',
  name: 'GaussianModel',
  component: () => import('@/views/gaussian/index.vue'),
  meta: {
    title: '高斯模型',
    icon: 'ep/coordinate',
    showLink: false,
    hideMenu: true,
    fullPage: true,
  },
}
