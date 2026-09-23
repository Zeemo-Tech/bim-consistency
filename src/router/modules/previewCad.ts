/**
 * CAD 图纸预览路由模块（DXF）
 */

export default {
  path: '/preview-cad/:id',
  name: 'PreviewCad',
  component: () => import('@/views/preview/cad.vue'),
  meta: {
    title: 'CAD 图纸预览',
    icon: 'ep/view',
    showLink: false,
    hideMenu: true,
    fullPage: true,
  },
}
