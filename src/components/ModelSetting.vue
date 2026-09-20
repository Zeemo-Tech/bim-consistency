<!-- 设置功能组件 -->
<template>
    <div class="model-setting-wrapper" id="model-setting-wrapper" style="width:460px">
        <el-dialog
            :model-value="visible"
            title="设置"
            width="450px"
            align-center
            :modal="false"
            :append-to-body="true"
            :close-on-click-modal="false"
            @close="onCancel" draggable
             modal-class="dialog_class"
        >
            <div class="model-setting-moudle">
                <el-row>
                    <el-col :span="8">基础展示</el-col>
                    <el-col :span="16">
                        <el-checkbox-group v-model="basicDisplay" @change="handleChangeValue">
                            <el-checkbox :label="WAREFRAME" name="wareframe">线框</el-checkbox>
                            <el-checkbox :label="REALITY" name="reality">材质</el-checkbox>
                            <el-checkbox :label="AXIS" name="axis" v-if="!isBimThing">轴网</el-checkbox>
                        </el-checkbox-group>
                    </el-col>
                </el-row>
                <el-row v-if="!isBimThing">
                    <el-col :span="8">构件组</el-col>
                    <el-col :span="16">
                      <el-switch
                        v-model="entityGroup"
                        size="large"
                        @change="handleChangeValue"
                      />
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">背景设置</el-col>
                    <el-col :span="16">
                        <div class="setColors" id="set-Colors-wrapper">
                            <el-select v-model="bgColor" size='small' class="m-2" style="width:160px;height:28px;float:left" ref="colorSelect"
                                @change="handleChangeColor" placeholder=" ">
                                <el-option-group
                                    v-for="(item,index) in colorsBlock"
                                    :key="index"
                                    :label="item.label"
                                    >
                                    <el-option class="color-select"
                                        v-for="(ele,indexx) in item.colorItems"
                                        :key="indexx"
                                        :value="ele.key"
                                    >
                                        <div class='color-item-wrapper'>
                                            <div class='color-item'>
                                                <div :style="{background: ele.type === 'gradient' ? `linear-gradient(180deg,rgba(${ele.color[0].join(',')},1) 0%,rgba(${ele.color[1] ? ele.color[1].join(',') : ele.color[0].join(',')},1) 100%)` : ele.key}">
                                                </div>
                                            </div>
                                            <span class='color-text'> {{ele.name}} </span>
                                        </div>
                                    </el-option>
                                </el-option-group>
                            </el-select>
                        </div>
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">模型视图</el-col>
                    <el-col :span="16">
                        <el-radio-group v-model="isOrthogonal" @change="handleChangeValue">
                            <el-radio :label="true">正交</el-radio>
                            <el-radio :label="false">透视</el-radio>
                        </el-radio-group>
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">环境阴影</el-col>
                    <el-col :span="16">
                        <el-radio-group v-model="lightVisible" @change="handleChangeValue">
                            <el-radio :label="true">开启</el-radio>
                            <el-radio :label="false">关闭</el-radio>
                        </el-radio-group>
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">光强度</el-col>
                    <el-col :span="16">
                        <el-slider v-model="ambientIntensity"
                            :marks="{
                                0:'0',
                                1:'1'
                            }"
                            :min="0" :max="1"
                            :step="0.1"
                            style="width:220px"
                            @input="handleChangeValue"/>
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">细粒度</el-col>
                    <el-col :span="16">
                        <el-slider v-model="diffuseIntensity"
                            :marks="{
                                    0:'0',
                                    100:'100'
                                }"
                            :min="0" :max="100"
                            :step="1"
                            style="width:220px"
                            @input="handleChangeValue"/>
                    </el-col>
                </el-row>
                <el-row>
                    <el-col :span="8">流畅度</el-col>
                    <el-col :span="16">
                        <el-slider v-model="frameLimitRatecity"
                            :marks="{
                                    0:'0',
                                    100:'100'
                                }"
                            :min="0" :max="100"
                            :step="5"
                            style="width:220px"
                            @input="handleChangeValue"/>
                    </el-col>
                </el-row>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="onCancel">取消</el-button>
                    <el-button type="primary" @click="handleClick">确定</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { colorsBlock, AXIS, WAREFRAME, REALITY } from '../config/modelColors'

interface Props {
    visible: boolean
    app: any
    setParms: any
    isBimThing?: boolean
}

interface Emits {
    (e: 'closeSetting'): void
    (e: 'changeSetParm', data: any): void
}

const props = withDefaults(defineProps<Props>(), {
    isBimThing: false
})

const emit = defineEmits<Emits>()

// 响应式数据
const sessionSetParm = ref(props.setParms)
const basicDisplay = ref(sessionSetParm.value?.basicDisplay || [])
const leftMouseOperation = ref(sessionSetParm.value?.leftMouseOperation)
const isOrthogonal = ref(sessionSetParm.value?.isOrthogonal || false)
const bgColor = ref(sessionSetParm.value?.bgColor || '#ABDAFF#FFFFFF')
const lightVisible = ref(sessionSetParm.value?.lightVisible !== undefined ? sessionSetParm.value.lightVisible : true)
const ambientIntensity = ref(sessionSetParm.value?.ambientIntensity !== undefined ? sessionSetParm.value.ambientIntensity : 0.8)
const diffuseIntensity = ref(sessionSetParm.value?.diffuseIntensity !== undefined ? sessionSetParm.value.diffuseIntensity : 50)
const opacity = ref(sessionSetParm.value?.opacity)
const frameLimitRatecity = ref(sessionSetParm.value?.frameLimitRatecity !== undefined ? sessionSetParm.value.frameLimitRatecity : 50)
const entityGroup = ref(sessionSetParm.value?.entityGroup !== undefined ? sessionSetParm.value.entityGroup : true)
const miniMapVisible = ref(sessionSetParm.value?.miniMapVisible || false)

// DOM引用
const colorSelect = ref()

const handleChangeColor = (value: string) => {
    bgColor.value = value
    setSelectColor(value)
    handleChangeValue()
}

const handleChangeValue = () => {
    const settingParm = {
        basicDisplay: basicDisplay.value || [],
        bgColor: bgColor.value,
        isOrthogonal: isOrthogonal.value,
        lightVisible: lightVisible.value,
        ambientIntensity: ambientIntensity.value,
        diffuseIntensity: diffuseIntensity.value,
        opacity: opacity.value,
        frameLimitRatecity: frameLimitRatecity.value,
        entityGroup: entityGroup.value,
        miniMapVisible: miniMapVisible.value,
    }
    emit('changeSetParm', settingParm)
}

// 设置颜色选择框中颜色
const setSelectColor = (color: string) => {
    nextTick(() => {
        const selectEl = colorSelect.value?.$el
        if (selectEl) {
            const inputEl = selectEl.querySelector(".el-input__inner")
            if (inputEl) {
                inputEl.style.background = color
                if(color === '#14253A#020406'){
                    inputEl.style.background = `linear-gradient(180deg, #14253A 0% ,#020406 100%)`
                }
                if(color === '#ABDAFF#FFFFFF'){
                    inputEl.style.background = `linear-gradient(180deg, #ABDAFF 0% ,#FFFFFF 100%)`
                }
                if(color === '#CEDEDC#F7F7F7'){
                    inputEl.style.background = `linear-gradient(180deg, #CEDEDC 0% ,#F7F7F7 100%)`
                }
                inputEl.style.height = '26px'
                inputEl.style.marginLeft = '-6px'
                inputEl.style.borderTopLeftRadius = '4px'
                inputEl.style.borderBottomLeftRadius = '4px'
                inputEl.style.fontSize = '0'
            }
        }
    })
}

// 设置光照、线框、真实、背景颜色
const onClickSetting = () => {
    if (!props.app) return

    const WIND = (window as any).WIND?.WIND
    if (!WIND) return

    const BackgroundType = WIND.MODEL.BackgroundType

    // 背景色设置
    const selectedColor = colorsBlock.flatMap(group => group.colorItems)
        .find(item => item.key === bgColor.value)

    if (selectedColor) {
        const background = selectedColor.color || []
        const backgroundImage = selectedColor.image || ''

        switch(selectedColor.type) {
            // 纯色
            case 'pure':
                props.app.effect().configBackground({pureRGB255: background[0]})
                props.app.effect().setBackgroundType(BackgroundType.PURE_COLOR)
                break
            // 渐变色
            case 'gradient':
                props.app.effect().configBackground({
                    gradientStartRGB255: background[0],
                    gradientEndRGB255: background[1],
                    gradientDirectionType: 0,
                })
                props.app.effect().setBackgroundType(BackgroundType.GRADIENT_COLOR)
                break
            // 静图
            case 'flatImg':
                if (backgroundImage) {
                    props.app.effect().setBackgroundFlatImage(backgroundImage)
                }
                props.app.effect().setBackgroundType(BackgroundType.FLAT_MAPPING)
                break
            // 全景
            case 'panormaImg':
                if (backgroundImage) {
                    props.app.effect().setBackgroundPanoramaImage(backgroundImage)
                }
                props.app.effect().setBackgroundType(BackgroundType.PANORAMA_MAPPING)
                break
        }
    }

    // 基础展示设置
    const basicDisplayArray = basicDisplay.value || []
    const realityVisible = basicDisplayArray.includes(REALITY)
    const wareVisible = basicDisplayArray.includes(WAREFRAME)
    const axisVisible = basicDisplayArray.includes(AXIS)

    props.app.effect().configSubject({
        realisticOpened: realityVisible,
        wireframeOpened: wareVisible
    })

    // 轴网
    if (!props.isBimThing) {
        if (axisVisible) {
            props.app.assist().openAxisgrid()
        } else {
            props.app.assist().closeAxisgrid()
        }
    }

    // 正交透视
    props.app.action().configRoaming({ orthogonalOpened: isOrthogonal.value })

    // 环境阴影
    props.app.effect().toggleLightShadow(lightVisible.value)
    props.app.effect().configLighting({ ambientIntensity: ambientIntensity.value })

    // 构件组
    props.app.effect().configSubject({
        relationOpened: entityGroup.value,
    })

    // 性能设置
    props.app.effect().configSubject({
        frameLimitRatecity: frameLimitRatecity.value,
        pixelCullRate: diffuseIntensity.value
    })

    const settingParm = {
        basicDisplay: basicDisplayArray,
        bgColor: bgColor.value,
        isOrthogonal: isOrthogonal.value,
        lightVisible: lightVisible.value,
        ambientIntensity: ambientIntensity.value,
        diffuseIntensity: diffuseIntensity.value,
        opacity: opacity.value,
        frameLimitRatecity: frameLimitRatecity.value,
        entityGroup: entityGroup.value,
        miniMapVisible: miniMapVisible.value,
    }

    emit('changeSetParm', settingParm)
    onCancel()
}

const handleClick = () => {
    onClickSetting()
}

const onCancel = () => {
    emit('closeSetting')
}

// 监听器
watch(() => props.setParms, (newValue) => {
    sessionSetParm.value = newValue
    basicDisplay.value = newValue?.basicDisplay || []
    ambientIntensity.value = newValue?.ambientIntensity || 0.8
    bgColor.value = newValue?.bgColor || '#ABDAFF#FFFFFF'
    diffuseIntensity.value = newValue?.diffuseIntensity || 50
    frameLimitRatecity.value = newValue?.frameLimitRatecity || 50
    isOrthogonal.value = newValue?.isOrthogonal || false
    lightVisible.value = newValue?.lightVisible !== undefined ? newValue.lightVisible : true
    opacity.value = newValue?.opacity
    entityGroup.value = newValue?.entityGroup !== undefined ? newValue.entityGroup : true
}, { deep: true, immediate: true })

watch(() => bgColor.value, (newValue) => {
    setSelectColor(newValue)
}, { deep: true, immediate: true })
</script>

<style scoped>
.model-setting-wrapper {
    /* 自定义样式 */
}

.model-setting-moudle {
    padding: 20px;
}

.model-setting-moudle .el-row {
    margin-bottom: 20px;
    align-items: center;
}

.model-setting-moudle .el-col {
    display: flex;
    align-items: center;
}

.setColors {
    width: 160px;
    height: 28px;
}

.color-select {
    height: 40px;
    padding: 0 10px;
}

.color-item-wrapper {
    display: flex;
    align-items: center;
    padding: 5px 0;
}

.color-item {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    margin-right: 10px;
    border: 1px solid #ddd;
}

.color-item div {
    width: 100%;
    height: 100%;
    border-radius: 4px;
}

.color-text {
    font-size: 14px;
    color: #333;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>
