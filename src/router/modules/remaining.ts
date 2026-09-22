import { $t } from '@/plugins/i18n'
const Layout = () => import('@/layout/index.vue')

export default [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      title: $t('menus.pureLogin'),
      showLink: false,
    },
  },
  // 全屏403（无权访问）页面
  {
    path: '/access-denied',
    name: 'AccessDenied',
    component: () => import('@/views/error/403.vue'),
    meta: {
      title: $t('menus.pureAccessDenied'),
      showLink: false,
    },
  },
  // 全屏500（服务器出错）页面
  {
    path: '/server-error',
    name: 'ServerError',
    component: () => import('@/views/error/500.vue'),
    meta: {
      title: $t('menus.pureServerError'),
      showLink: false,
    },
  },
  {
    path: '/redirect',
    component: Layout,
    meta: {
      title: $t('status.pureLoad'),
      showLink: false,
    },
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/layout/redirect.vue'),
      },
    ],
  },
  // 下面是一个无layout菜单的例子（一个全屏空白页面），因为这种情况极少发生，所以只需要在前端配置即可（配置路径：src/router/modules/remaining.ts）
  {
    path: '/empty',
    name: 'Empty',
    component: () => import('@/views/empty/index.vue'),
    meta: {
      title: $t('menus.pureEmpty'),
      showLink: false,
    },
  },
  // BIM校准页面
  {
    path: '/calibrateBIM',
    name: 'CalibrateBIM',
    component: () =>
      import('@/views/data/history-model/components/calibrateBIM.vue'),
    meta: {
      title: 'BIM模型与点云校准',
      showLink: false,
    },
  },
  // CAD校准页面
  {
    path: '/calibrateCAD',
    name: 'CalibrateCAD',
    component: () => import('@/views/data/calibration/index.vue'),
    meta: {
      title: 'CAD图纸与巡检轨迹校准',
      showLink: false,
    },
  },
  // ==================== CloudBIM 风格新框架 ====================
  // 项目选择（登录后落地页）
  {
    path: '/projects',
    name: 'CloudBimProjects',
    component: () => import('@/views/cloudbim/projects/index.vue'),
    meta: {
      title: '项目',
      showLink: false,
    },
  },
  // 项目工作区 - 设计信息
  {
    path: '/design/overview',
    name: 'CloudBimOverview',
    component: () => import('@/views/cloudbim/design/overview.vue'),
    meta: {
      title: '项目概述',
      showLink: false,
    },
  },
  {
    path: '/design/cad',
    name: 'CloudBimCad',
    component: () => import('@/views/cloudbim/design/cad.vue'),
    meta: {
      title: 'CAD图纸',
      showLink: false,
    },
  },
  {
    path: '/design/bim',
    name: 'CloudBimBim',
    component: () => import('@/views/cloudbim/design/bim.vue'),
    meta: {
      title: '设计模型',
      showLink: false,
    },
  },
  // 项目工作区 - 实测数据
  {
    path: '/survey',
    name: 'CloudBimSurvey',
    component: () => import('@/views/cloudbim/survey/index.vue'),
    meta: {
      title: '扫描点云',
      showLink: false,
    },
  },
  // 设备中心
  {
    path: '/devices',
    name: 'CloudBimDevices',
    component: () => import('@/views/cloudbim/devices/index.vue'),
    meta: {
      title: '设备中心',
      showLink: false,
    },
  },
  // 系统管理（右上角头像下拉入口）
  {
    path: '/system',
    name: 'CloudBimSystem',
    component: () => import('@/views/cloudbim/system/index.vue'),
    meta: {
      title: '系统管理',
      showLink: false,
    },
  },
] satisfies Array<RouteConfigsTable>
