import { reactive } from "vue";
import { isPhone } from "@pureadmin/utils";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";

/** 6位数字验证码正则 */
export const REGEXP_SIX = /^\d{6}$/;

/** 密码正则（密码格式应为8-18位数字、字母、符号的任意两种组合） */
export const REGEXP_PWD =
  /^(?![0-9]+$)(?![a-z]+$)(?![A-Z]+$)(?!([^(0-9a-zA-Z)]|[()])+$)(?!^.*[\u4E00-\u9FA5].*$)([^(0-9a-zA-Z)]|[()]|[a-z]|[A-Z]|[0-9]){8,18}$/;

/** 注册/忘记密码校验 */
const updateRules = reactive<FormRules>({
  phone: [
    {
      required: true,
      message: transformI18n($t("login.purePhoneReg")),
      trigger: "blur"
    },
    {
      type: "email",
      message: "请输入正确的邮箱格式",
      trigger: ["blur", "change"]
    }
  ],
  verifyCode: [
    {
      validator: (rule, value, callback) => {
        // 验证码改为非必填，如果填写了才验证格式
        if (value && !REGEXP_SIX.test(value)) {
          callback(new Error(transformI18n($t("login.pureVerifyCodeSixReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      message: transformI18n($t("login.purePassWordReg")),
      trigger: "blur"
    },
    {
      min: 6,
      message: "密码长度不能少于6位",
      trigger: "blur"
    }
  ]
});

export { updateRules };

