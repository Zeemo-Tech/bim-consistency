import { http } from "@/utils/http";

/** 菜单项类型定义 */
export interface MenuItem {
  /** 路由路径 */
  path: string;
  /** 路由名称 */
  name: string;
  /** 组件路径 */
  component: string;
  /** 页面标题 */
  title: string;
  /** 图标 */
  icon: string;
  /** 是否显示在菜单中 */
  show: boolean;
  /** 子菜单 */
  children?: MenuItem[];
}

/** 菜单响应类型 */
export interface MenuResponse {
  code: number;
  data: MenuItem[];
  msg: string;
}

/**
 * 获取用户菜单列表
 * 根据组织身份、角色权限筛选菜单
 * 接口会自动从请求头中获取 X-Organization-Id
 */
export const getUserMenus = () => {
  return http.request<MenuResponse>('get', '/api/me/menus');
};

/** 旧版路由接口类型 */
type Result = {
  success: boolean;
  data: Array<any>;
};

/**
 * @deprecated 请使用 getUserMenus 替代
 * 模拟后端返回的路由数据
 */
export const getAsyncRoutes = () => {
  return new Promise<Result>((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: []
      });
    }, 100);
  });
};
