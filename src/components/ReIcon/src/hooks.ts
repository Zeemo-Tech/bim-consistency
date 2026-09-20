import { h, defineComponent } from "vue";
import type { Component } from "vue";

/**
 * 支持 `element-plus` 和 `iconify` 的图标渲染
 */
export const useRenderIcon = (icon: Component) => {
  return () => h(icon);
};
