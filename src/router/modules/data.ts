const Layout = () => import('@/layout/index.vue');

export default {
  path: "/data",
  name: "Data",
  component: Layout,
  redirect: "/data/history-model",
  meta: {
    title: "数据管理",
    icon: "ri:database-2-line",
    rank: 8,
    showLink: false
  },
  children: [
    {
      path: "/calibrateBIM",
      name: "CalibrateBIM",
      component: () => import("@/views/data/history-model/components/calibrateBIM.vue"),
      meta: {
        title: "BIM校准",
        showLink: false // 不在菜单中显示
      }
    },
    {
      path: "/calibrateCAD",
      name: "CalibrateCAD",
      component: () => import("@/views/data/calibration/index.vue"),
      meta: {
        title: "CAD校准",
        showLink: false // 不在菜单中显示
      }
    },
    {
      path: "/drawing-calibration",
      name: "DrawingCalibration",
      component: () => import("@/views/data/drawing-calibration/index.vue"),
      meta: {
        title: "图纸校验",
        showLink: false // 不在菜单中显示
      }
    }
  ]
};
