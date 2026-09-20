// 模型背景颜色配置
export const AXIS = "axis"; // 轴线
export const WAREFRAME = "wareframe"; // 线框
export const REALITY = "reality"; // 材质（真实）
export const ORTHO = "orthogonality"; // 正交
export const PERSPECT = "perspectivity"; // 透视

// 选色
export const colorsBlock = [
  {
    type: "pure",
    label: "纯色",
    colorItems: [
      {
        color: [[255, 255, 255]],
        type: "pure",
        key: "#FFFFFF",
        name: "纯白",
      },
      {
        color: [[15, 20, 35]],
        key: "#0F1423",
        type: "pure",
        name: "幽静",
      },
      {
        color: [[51, 51, 51]],
        type: "pure",
        key: "#333333",
        name: "暗昏",
      },
    ],
  },
  {
    type: "gradient",
    label: "渐变",
    colorItems: [
      {
        color: [
          [171, 218, 255],
          [255, 255, 255],
        ],
        key: "#ABDAFF#FFFFFF",
        type: "gradient",
        name: "晴天",
      },
      {
        color: [
          [20, 37, 58],
          [2, 4, 6],
        ],
        key: "#14253A#020406",
        type: "gradient",
        name: "深夜",
      },
      {
        color: [
          [206, 222, 220],
          [247, 247, 247],
        ],
        key: "#CEDEDC#F7F7F7",
        type: "gradient",
        name: "宁静",
      },
    ],
  },
  {
    type: "flatImg",
    label: "静图",
    colorItems: [
      {
        thumb: null,
        image: null,
        key: "sky",
        type: "flatImg",
        name: "蓝天白云",
      },
      {
        thumb: null,
        image: null,
        key: "dark",
        type: "flatImg",
        name: "静谧夜空",
      },
      {
        thumb: null,
        image: null,
        key: "star",
        type: "flatImg",
        name: "璀璨星河",
      },
    ],
  },
  {
    type: "panormaImg",
    label: "全景",
    colorItems: [
      {
        thumb: null,
        image: null,
        key: "green",
        type: "panormaImg",
        name: "森林草丛",
      },
    ],
  },
];