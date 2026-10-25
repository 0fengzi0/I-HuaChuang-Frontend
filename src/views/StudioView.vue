<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  Aperture,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  Expand,
  Heart,
  Images,
  Info,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import ProtectedImage from '../components/ProtectedImage.vue'
import {
  APIError,
  apiBlob,
  apiRequest,
  type CreateGenerationResponse,
  type Generation,
  type GenerationOutput,
  type GenerationSettings,
  type ReuseResponse,
} from '../api/client'
import { usePublicSettings } from '../composables/usePublicSettings'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'

type AspectRatioValue =
  | '1:1'
  | '3:2'
  | '2:3'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '21:9'
  | '9:21'
  | 'original'
type StandardAspectRatioValue = Exclude<AspectRatioValue, 'original'>
type ResolutionValue = '1K' | '2K'
type ModeValue = 'generate' | 'edit'
type QualityValue = 'auto' | 'low' | 'medium' | 'high'
type BackgroundValue = 'auto' | 'transparent' | 'opaque'

interface ReferencePreview {
  id: string
  file: File
  url: string
  width: number
  height: number
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const queryClient = useQueryClient()
const { data: publicSettings, isLoading: settingsLoading } = usePublicSettings()
const mode = ref<ModeValue>('generate')
const prompt = ref('')
const selectedAspectRatio = ref<AspectRatioValue>('1:1')
const selectedResolution = ref<ResolutionValue>('1K')
const quality = ref<QualityValue>('auto')
const background = ref<BackgroundValue>('auto')
const count = ref(1)
const references = ref<ReferencePreview[]>([])
const uploadError = ref('')
const submitError = ref('')
const submitting = ref(false)
const activeGenerationId = ref('')
const selectedAssetId = ref('')
const downloading = ref(false)
const favoriteSaving = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const advancedOpen = ref(false)
const stageOpen = ref(false)
let terminalGenerationID = ''

const generationQuery = useQuery({
  queryKey: computed(() => ['generation', activeGenerationId.value]),
  queryFn: () =>
    apiRequest<Generation>(`/api/generations/${encodeURIComponent(activeGenerationId.value)}`),
  enabled: computed(() => Boolean(activeGenerationId.value)),
  refetchInterval: (query) => {
    const status = query.state.data?.status
    return status && ['succeeded', 'partially_succeeded', 'failed', 'canceled'].includes(status)
      ? false
      : 1500
  },
})

const activeGeneration = computed(() => generationQuery.data.value ?? null)
const stageVisible = computed(() => stageOpen.value)
const stageError = computed(
  () => submitError.value && !submitting.value && !activeGeneration.value,
)
const selectedOutput = computed<GenerationOutput | null>(() => {
  const generation = activeGeneration.value
  if (!generation) {
    return null
  }
  return (
    generation.outputs.find((output) => output.asset?.id === selectedAssetId.value) ??
    generation.outputs.find((output) => output.asset) ??
    null
  )
})
const activeStatus = computed(() => activeGeneration.value?.status ?? null)
const taskIsActive = computed(
  () =>
    Boolean(activeGeneration.value) &&
    ['preparing', 'queued', 'running'].includes(activeGeneration.value!.status),
)
const renderStep = computed(() => {
  if (submitting.value) {
    return 1
  }
  switch (activeStatus.value) {
    case 'preparing':
    case 'queued':
      return 1
    case 'running':
      return 2
    case 'succeeded':
    case 'partially_succeeded':
      return 3
    default:
      return 0
  }
})
const canSubmit = computed(
  () =>
    Boolean(publicSettings.value?.generationReady) &&
    !submitting.value &&
    !taskIsActive.value &&
    prompt.value.trim().length > 0,
)

const aspectRatioOptions: Array<{
  value: AspectRatioValue
  label: string
  ratio: string
}> = [
  { value: '1:1', label: '方形', ratio: '1 : 1' },
  { value: '3:2', label: '横向', ratio: '3 : 2' },
  { value: '2:3', label: '纵向', ratio: '2 : 3' },
  { value: '16:9', label: '宽屏', ratio: '16 : 9' },
  { value: '9:16', label: '竖屏', ratio: '9 : 16' },
  { value: '4:3', label: '经典', ratio: '4 : 3' },
  { value: '3:4', label: '竖版', ratio: '3 : 4' },
  { value: '21:9', label: '超宽', ratio: '21 : 9' },
  { value: '9:21', label: '超长', ratio: '9 : 21' },
  { value: 'original', label: '原始', ratio: '随原图' },
]

const resolutionOptions: Array<{
  value: ResolutionValue
  label: string
  description: string
}> = [
  { value: '1K', label: '1K', description: '快速草稿' },
  { value: '2K', label: '2K', description: '标准成片' },
]

const resolutionDimensions: Record<
  ResolutionValue,
  Record<StandardAspectRatioValue, string>
> = {
  '1K': {
    '1:1': '1024x1024',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '16:9': '1536x864',
    '9:16': '864x1536',
    '4:3': '1365x1024',
    '3:4': '1024x1365',
    '21:9': '1536x658',
    '9:21': '658x1536',
  },
  '2K': {
    '1:1': '2048x2048',
    '3:2': '3072x2048',
    '2:3': '2048x3072',
    '16:9': '3072x1728',
    '9:16': '1728x3072',
    '4:3': '2731x2048',
    '3:4': '2048x2731',
    '21:9': '3072x1317',
    '9:21': '1317x3072',
  },
}

const qualityOptions: Array<{ value: QualityValue; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '快速' },
  { value: 'medium', label: '标准' },
  { value: 'high', label: '精细' },
]

const backgroundOptions: Array<{ value: BackgroundValue; label: string }> = [
  { value: 'auto', label: '自动背景' },
  { value: 'opaque', label: '不透明' },
  { value: 'transparent', label: '透明' },
]

const samplePrompts = [
  '雨后的玻璃温室，蓝橙色油墨在空气中缓慢扩散，真实微距摄影',
  '一把旧画刷停在被晚霞照亮的宣纸上，保留颜料厚度',
]

const unitCost = computed(() => publicSettings.value?.pricing[selectedResolution.value] ?? 0)
const totalCost = computed(() => unitCost.value * count.value)
const availableCredits = computed(
  () => auth.user?.availableCredits ?? auth.user?.creditBalance ?? 0,
)
const originalReference = computed(() =>
  references.value.find((reference) => reference.width > 0 && reference.height > 0),
)
const originalRatioAvailable = computed(
  () => mode.value === 'edit' && Boolean(originalReference.value),
)
const requestedSize = computed(() => {
  if (selectedAspectRatio.value === 'original') {
    const reference = originalReference.value
    if (!reference) {
      return '等待参考图'
    }
    return originalTargetSize(reference.width, reference.height, selectedResolution.value)
  }
  return resolutionDimensions[selectedResolution.value][
    selectedAspectRatio.value as StandardAspectRatioValue
  ]
})
const canvasRatio = computed(() => {
  if (selectedAspectRatio.value === 'original' && originalReference.value) {
    return `${originalReference.value.width} / ${originalReference.value.height}`
  }
  switch (selectedAspectRatio.value) {
    case '3:2':
      return '3 / 2'
    case '2:3':
      return '2 / 3'
    case '16:9':
      return '16 / 9'
    case '9:16':
      return '9 / 16'
    case '4:3':
      return '4 / 3'
    case '3:4':
      return '3 / 4'
    case '21:9':
      return '21 / 9'
    case '9:21':
      return '9 / 21'
    default:
      return '1 / 1'
  }
})
const canvasAspect = computed(() => {
  if (selectedAspectRatio.value === 'original' && originalReference.value) {
    return originalReference.value.width / originalReference.value.height
  }
  switch (selectedAspectRatio.value) {
    case '3:2':
      return 3 / 2
    case '2:3':
      return 2 / 3
    case '16:9':
      return 16 / 9
    case '9:16':
      return 9 / 16
    case '4:3':
      return 4 / 3
    case '3:4':
      return 3 / 4
    case '21:9':
      return 21 / 9
    case '9:21':
      return 9 / 21
    default:
      return 1
  }
})
const statusLabel = computed(() => {
  if (submitting.value) return '正在提交'
  if (stageError.value) return '等待重新提交'
  switch (activeStatus.value) {
    case 'preparing':
      return '准备画面'
    case 'queued':
      return '等待开始'
    case 'running':
      return '正在绘制'
    case 'succeeded':
      return '作品完成'
    case 'partially_succeeded':
      return '部分完成'
    case 'failed':
      return '生成失败'
    case 'canceled':
      return '已取消'
    default:
      return '画布'
  }
})
const statusHint = computed(() => {
  switch (activeStatus.value) {
    case 'preparing':
      return '正在检查参考图并准备创作'
    case 'queued':
      return '已经排上队，轮到你时会自动开始绘制'
    case 'running':
      return `正在绘制，已完成 ${activeGeneration.value?.outputs.filter((output) => output.status === 'succeeded').length ?? 0} / ${activeGeneration.value?.outputs.length ?? count.value} 张`
    case 'partially_succeeded':
      return '部分图片已经完成，没有生成的图片不会扣积分'
    case 'failed':
      return activeGeneration.value?.errorMessage || '这次没有生成图片，冻结的积分已经退回'
    case 'succeeded':
      return `作品已经保存，本次使用 ${activeGeneration.value?.chargedCredits ?? 0} 积分`
    default:
      return '画面会在这里慢慢显现'
  }
})
const heroTitle = computed(() => {
  if (!stageVisible.value) return '今天想画什么？'
  if (submitting.value || taskIsActive.value) return '正在为你创作'
  if (activeStatus.value === 'succeeded' || activeStatus.value === 'partially_succeeded') {
    return '你的画面完成了'
  }
  if (activeStatus.value === 'failed' || stageError.value) return '这次没有完成'
  return '画面正在展开'
})
const heroDescription = computed(() =>
  stageVisible.value
    ? '图片会留在画布上，下面的描述和参数可以继续调整。'
    : '写下一句话，选择比例和清晰度，就可以开始。',
)
const renderStages = ['已提交', '正在绘制', '处理图片']

function setMode(nextMode: ModeValue) {
  mode.value = nextMode
  if (nextMode === 'generate') {
    clearReferences()
    if (selectedAspectRatio.value === 'original') {
      selectedAspectRatio.value = '1:1'
    }
  }
}

function decrementCount() {
  count.value = Math.max(1, count.value - 1)
}

function incrementCount() {
  count.value = Math.min(4, count.value + 1)
}

function choosePrompt(value: string) {
  prompt.value = value
}

function originalTargetSize(width: number, height: number, resolution: ResolutionValue) {
  const aspect = width / height
  const longEdge = resolution === '2K' ? 3072 : 1536
  const shortEdge = resolution === '2K' ? 2048 : 1024
  let targetWidth: number
  let targetHeight: number
  if (aspect >= 1) {
    targetWidth = longEdge
    targetHeight = Math.round(longEdge / aspect)
    if (targetHeight > shortEdge) {
      targetHeight = shortEdge
      targetWidth = Math.round(shortEdge * aspect)
    }
  } else {
    targetHeight = longEdge
    targetWidth = Math.round(longEdge * aspect)
    if (targetWidth > shortEdge) {
      targetWidth = shortEdge
      targetHeight = Math.round(shortEdge / aspect)
    }
  }
  return `${targetWidth}x${targetHeight}`
}

function readImageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('image dimensions could not be read'))
    image.src = url
  })
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleFiles(event: Event) {
  uploadError.value = ''
  const input = event.target as HTMLInputElement
  if (!input.files) {
    return
  }
  const remaining = 4 - references.value.length
  const files = Array.from(input.files).slice(0, remaining)
  for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      uploadError.value = '仅支持 PNG、JPEG 或 WebP 图片。'
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      uploadError.value = '单张参考图不能超过 10 MB。'
      continue
    }
    const preview: ReferencePreview = {
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      width: 0,
      height: 0,
    }
    references.value.push(preview)
    void readImageDimensions(preview.url)
      .then(({ width, height }) => {
        const current = references.value.find((reference) => reference.id === preview.id)
        if (current) {
          current.width = width
          current.height = height
        }
      })
      .catch(() => {
        if (references.value.some((reference) => reference.id === preview.id)) {
          uploadError.value = '参考图尺寸无法读取，请更换图片。'
        }
      })
  }
  input.value = ''
}

function removeReference(id: string) {
  const target = references.value.find((item) => item.id === id)
  if (target) {
    URL.revokeObjectURL(target.url)
  }
  references.value = references.value.filter((item) => item.id !== id)
  if (references.value.length === 0 && selectedAspectRatio.value === 'original') {
    selectedAspectRatio.value = '1:1'
  }
}

function clearReferences() {
  for (const reference of references.value) {
    URL.revokeObjectURL(reference.url)
  }
  references.value = []
}

async function submitGeneration() {
  submitError.value = ''
  if (!prompt.value.trim()) {
    submitError.value = '请先描述要生成的画面。'
    return
  }
  if (!publicSettings.value?.generationReady) {
    submitError.value = '生成服务尚未连接，请联系管理员配置中转站。'
    return
  }
  if (mode.value === 'edit' && references.value.length === 0) {
    submitError.value = '图生图至少需要一张参考图。'
    return
  }
  submitting.value = true
  stageOpen.value = true
  activeGenerationId.value = ''
  selectedAssetId.value = ''
  try {
    const form = new FormData()
    form.append('mode', mode.value)
    form.append('prompt', prompt.value)
    form.append('aspectRatio', selectedAspectRatio.value)
    form.append('resolution', selectedResolution.value)
    form.append('quality', quality.value)
    form.append('background', background.value)
    form.append('count', String(count.value))
    for (const reference of references.value) {
      form.append('images', reference.file, reference.file.name)
    }
    const created = await apiRequest<CreateGenerationResponse>('/api/generations', {
      method: 'POST',
      body: form,
    })
    activeGenerationId.value = created.id
    terminalGenerationID = ''
    auth.updateCredits(
      Math.max(0, (auth.user?.availableCredits ?? 0) - created.estimatedCredits),
      (auth.user?.reservedCredits ?? 0) + created.estimatedCredits,
    )
    notifications.push('任务已提交，积分已按张数冻结。', 'success')
    await queryClient.invalidateQueries({ queryKey: ['generations', 'recent'] })
  } catch (error) {
    submitError.value = error instanceof APIError ? error.message : '任务提交失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}

function startNewGeneration() {
  if (submitting.value || taskIsActive.value) {
    return
  }
  clearReferences()
  mode.value = 'generate'
  prompt.value = ''
  selectedAspectRatio.value = '1:1'
  selectedResolution.value = '1K'
  quality.value = 'auto'
  background.value = 'auto'
  count.value = 1
  advancedOpen.value = false
  submitError.value = ''
  stageOpen.value = false
  activeGenerationId.value = ''
  selectedAssetId.value = ''
  terminalGenerationID = ''
  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  })
}

function selectOutput(output: GenerationOutput) {
  if (output.asset) {
    selectedAssetId.value = output.asset.id
  }
}

async function downloadCurrent() {
  const asset = selectedOutput.value?.asset
  if (!asset) {
    return
  }
  downloading.value = true
  try {
    const blob = await apiBlob(`/api/assets/${encodeURIComponent(asset.id)}/download`)
    const objectURL = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectURL
    anchor.download = `ihuachuang-${activeGeneration.value?.id.slice(0, 8) ?? 'image'}-${asset.id.slice(-6)}.png`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(objectURL), 1000)
  } catch {
    notifications.push('图片暂时无法下载。', 'warning')
  } finally {
    downloading.value = false
  }
}

async function toggleFavorite() {
  const generation = activeGeneration.value
  const asset = selectedOutput.value?.asset
  if (!generation || !asset) {
    return
  }
  favoriteSaving.value = true
  try {
    await apiRequest(`/api/generations/${encodeURIComponent(generation.id)}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ assetId: asset.id, favorite: !asset.isFavorite }),
    })
    notifications.push(asset.isFavorite ? '已取消收藏。' : '已加入收藏。', 'success')
    await Promise.all([
      generationQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['generations'] }),
    ])
  } catch {
    notifications.push('收藏状态暂时无法保存。', 'warning')
  } finally {
    favoriteSaving.value = false
  }
}

async function applyReuse() {
  const reuseID = typeof route.query.reuse === 'string' ? route.query.reuse : ''
  if (!reuseID) {
    return
  }
  try {
    const reused = await apiRequest<ReuseResponse>(
      `/api/generations/${encodeURIComponent(reuseID)}/reuse`,
      { method: 'POST' },
    )
    prompt.value = reused.prompt
    mode.value = reused.mode
    applySettings(reused.settings)
    await router.replace({ name: 'studio' })
    notifications.push('参数已填入工作台。', 'success')
  } catch {
    notifications.push('参数快照暂时无法读取。', 'warning')
  }
}

function applySettings(settings: GenerationSettings) {
  if (settings.aspectRatio) {
    selectedAspectRatio.value =
      settings.aspectRatio === 'original' && references.value.length === 0
        ? '1:1'
        : settings.aspectRatio
  }
  if (settings.resolution) {
    selectedResolution.value = settings.resolution === '4K' ? '2K' : settings.resolution
  }
  if (!settings.aspectRatio && !settings.resolution && settings.size) {
    applyLegacySize(settings.size)
  }
  if (settings.quality) quality.value = settings.quality
  if (settings.background) background.value = settings.background
}

function applyLegacySize(size: string) {
  if (size === '1536x1024') {
    selectedAspectRatio.value = '3:2'
    selectedResolution.value = '1K'
  } else if (size === '1024x1536') {
    selectedAspectRatio.value = '2:3'
    selectedResolution.value = '1K'
  } else if (size === '2048x2048') {
    selectedResolution.value = '2K'
  } else if (size === '3072x2048') {
    selectedAspectRatio.value = '3:2'
    selectedResolution.value = '2K'
  } else if (size === '2048x3072') {
    selectedAspectRatio.value = '2:3'
    selectedResolution.value = '2K'
  } else if (size === '2880x2880' || size === '3840x3840') {
    selectedAspectRatio.value = '1:1'
    selectedResolution.value = '2K'
  } else if (size === '3456x2304' || size === '3840x2160') {
    selectedAspectRatio.value = '3:2'
    selectedResolution.value = '2K'
  } else if (size === '2304x3456' || size === '2160x3840') {
    selectedAspectRatio.value = '2:3'
    selectedResolution.value = '2K'
  } else if (size === '1536x864') {
    selectedAspectRatio.value = '16:9'
    selectedResolution.value = '1K'
  } else if (size === '864x1536') {
    selectedAspectRatio.value = '9:16'
    selectedResolution.value = '1K'
  } else if (size === '1365x1024') {
    selectedAspectRatio.value = '4:3'
    selectedResolution.value = '1K'
  } else if (size === '1024x1365') {
    selectedAspectRatio.value = '3:4'
    selectedResolution.value = '1K'
  } else if (size === '1536x658') {
    selectedAspectRatio.value = '21:9'
    selectedResolution.value = '1K'
  } else if (size === '658x1536') {
    selectedAspectRatio.value = '9:21'
    selectedResolution.value = '1K'
  } else if (size === '3072x1728') {
    selectedAspectRatio.value = '16:9'
    selectedResolution.value = '2K'
  } else if (size === '1728x3072') {
    selectedAspectRatio.value = '9:16'
    selectedResolution.value = '2K'
  } else if (size === '2731x2048') {
    selectedAspectRatio.value = '4:3'
    selectedResolution.value = '2K'
  } else if (size === '2048x2731') {
    selectedAspectRatio.value = '3:4'
    selectedResolution.value = '2K'
  } else if (size === '3072x1317') {
    selectedAspectRatio.value = '21:9'
    selectedResolution.value = '2K'
  } else if (size === '1317x3072') {
    selectedAspectRatio.value = '9:21'
    selectedResolution.value = '2K'
  }
}

function openPreview() {
  if (!selectedOutput.value?.asset) {
    return
  }
  previewDialog.value?.showModal()
}

function closePreview() {
  previewDialog.value?.close()
}

function closeDialogFromBackdrop(event: MouseEvent) {
  if (event.target === previewDialog.value) {
    closePreview()
  }
}

watch(activeGeneration, async (generation) => {
  if (!generation) {
    return
  }
  auth.updateCredits(generation.availableCredits, generation.reservedCredits)
  if (generation.outputs.some((output) => output.asset) && !selectedAssetId.value) {
    selectedAssetId.value = generation.outputs.find((output) => output.asset)?.asset?.id ?? ''
  }
  if (
    ['succeeded', 'partially_succeeded', 'failed', 'canceled'].includes(generation.status) &&
    terminalGenerationID !== generation.id
  ) {
    terminalGenerationID = generation.id
    await queryClient.invalidateQueries({ queryKey: ['generations'] })
    if (generation.status === 'succeeded' || generation.status === 'partially_succeeded') {
      window.dispatchEvent(new Event('recent-works-changed'))
      notifications.push(
        generation.status === 'succeeded' ? '图片已完成。' : '部分图片已完成，失败输出未扣费。',
        generation.status === 'succeeded' ? 'success' : 'warning',
      )
    } else if (generation.status === 'failed') {
      notifications.push(generation.errorMessage || '图片生成失败，冻结积分已释放。', 'error')
    }
  }
})

watch(
  () => route.query.reuse,
  () => void applyReuse(),
  { immediate: true },
)

onBeforeUnmount(() => {
  clearReferences()
})
</script>

<template>
  <div class="studio-page" :class="{ 'studio-page--creating': stageVisible }">
    <header class="studio-hero">
      <div class="studio-hero__copy">
        <h1>{{ heroTitle }}</h1>
        <p>{{ heroDescription }}</p>
      </div>
      <Transition name="status-fade">
        <span v-if="stageVisible" class="studio-hero__status" aria-live="polite">
          <i
            :class="{
              'is-active': submitting || taskIsActive,
              'is-ready': activeStatus === 'succeeded',
              'is-error': activeStatus === 'failed' || stageError,
            }"
          />
          {{ statusLabel }}
        </span>
      </Transition>
    </header>

    <div v-if="!stageVisible" class="studio-toolbar">
      <div class="mode-switch" role="tablist" aria-label="生成模式">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'generate'"
          :class="{ 'is-active': mode === 'generate' }"
          :disabled="taskIsActive || submitting"
          @click="setMode('generate')"
        >
          <WandSparkles :size="16" aria-hidden="true" />
          用文字画
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'edit'"
          :class="{ 'is-active': mode === 'edit' }"
          :disabled="taskIsActive || submitting"
          @click="setMode('edit')"
        >
          <Images :size="16" aria-hidden="true" />
          按图片改
        </button>
      </div>
      <div class="workspace-status" aria-live="polite">
        <span class="status-dot" :class="{ 'status-dot--ready': publicSettings?.generationReady }" />
        <span v-if="settingsLoading">正在检查生成服务</span>
        <span v-else-if="publicSettings?.generationReady">
          {{ stageVisible ? statusLabel : '可以开始创作' }}
        </span>
        <span v-else>生成服务暂未连接，账户功能仍可使用</span>
      </div>
      <div class="toolbar-meta">
        <span>图片保留 {{ publicSettings?.retentionDays ?? 7 }} 天</span>
        <span>PNG</span>
      </div>
    </div>

    <div class="studio-layout" :class="{ 'is-creating': stageVisible }">
      <section
        v-if="stageVisible"
        class="workspace"
        aria-label="创作画布"
      >
        <article class="canvas-card">
          <header class="canvas-head">
            <div class="canvas-head__copy">
              <span class="canvas-live">
                <i
                  :class="{
                    'is-processing': submitting || taskIsActive,
                    'is-error': activeStatus === 'failed' || stageError,
                    'is-ready': activeStatus === 'succeeded',
                  }"
                />
                {{ statusLabel }}
              </span>
              <span class="canvas-size">
                {{
                  selectedOutput?.asset
                    ? `${selectedOutput.asset.width} × ${selectedOutput.asset.height}`
                    : requestedSize
                }}
                · PNG
              </span>
            </div>
            <button
              v-if="selectedOutput?.asset"
              type="button"
              class="icon-button"
              aria-label="全屏查看作品"
              title="全屏查看"
              @click="openPreview"
            >
              <Expand :size="18" aria-hidden="true" />
            </button>
          </header>

          <button
            type="button"
            class="canvas-frame"
            :class="{ 'is-result': Boolean(selectedOutput?.asset) }"
            :style="{ '--canvas-ratio': canvasRatio, '--canvas-aspect': canvasAspect }"
            :disabled="!selectedOutput?.asset"
            :aria-label="selectedOutput?.asset ? '全屏查看生成结果' : statusLabel"
            @click="openPreview"
          >
            <span v-if="selectedOutput?.asset" class="canvas-media">
              <ProtectedImage
                :key="selectedOutput.asset.id"
                :asset-id="selectedOutput.asset.id"
                :alt="activeGeneration?.prompt || '生成结果'"
                class="canvas-result-image"
              />
            </span>

            <div
              v-else-if="submitting || taskIsActive"
              class="canvas-task-state"
              aria-live="polite"
            >
              <span class="canvas-task-mark">
                <LoaderCircle class="spin" :size="28" aria-hidden="true" />
              </span>
              <strong>{{ submitting ? '正在提交你的想法' : statusLabel }}</strong>
              <span>{{ submitting ? '马上就会开始绘制' : statusHint }}</span>
              <ol class="render-steps" aria-label="生成进度">
                <li
                  v-for="(stage, index) in renderStages"
                  :key="stage"
                  :class="{
                    'is-complete': renderStep > index + 1,
                    'is-current': renderStep === index + 1,
                  }"
                >
                  <span>
                    <CheckCircle2
                      v-if="renderStep > index + 1"
                      :size="14"
                      aria-hidden="true"
                    />
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <strong>{{ stage }}</strong>
                </li>
              </ol>
              <div v-if="activeGeneration?.outputs.length" class="task-progress">
                <i
                  v-for="(output, index) in activeGeneration.outputs"
                  :key="output.id"
                  :class="{
                    'is-done': output.status === 'succeeded',
                    'is-error': output.status === 'failed',
                  }"
                  :title="`第 ${index + 1} 张`"
                >
                  {{ index + 1 }}
                </i>
              </div>
            </div>

            <div v-else-if="stageError" class="canvas-task-state canvas-task-state--error">
              <span class="canvas-task-mark">
                <CircleAlert :size="27" aria-hidden="true" />
              </span>
              <strong>还没有开始生成</strong>
              <span>{{ submitError }} 你可以在下方检查设置后重新提交。</span>
            </div>

            <div
              v-else-if="
                activeGeneration &&
                ['failed', 'partially_succeeded'].includes(activeGeneration.status)
              "
              class="canvas-task-state canvas-task-state--error"
            >
              <span class="canvas-task-mark">
                <CircleAlert :size="27" aria-hidden="true" />
              </span>
              <strong>{{ statusLabel }}</strong>
              <span>{{ statusHint }}</span>
            </div>

            <div v-else class="canvas-task-state">
              <span class="canvas-task-mark">
                <Sparkles :size="26" aria-hidden="true" />
              </span>
              <strong>画布准备中</strong>
              <span>图片完成后会在这里慢慢显现。</span>
            </div>
          </button>

          <div
            v-if="activeGeneration && activeGeneration.outputs.length > 1"
            class="output-strip"
            aria-label="本次生成图片"
          >
            <button
              v-for="output in activeGeneration.outputs"
              :key="output.id"
              type="button"
              :class="{ 'is-selected': selectedAssetId === output.asset?.id }"
              :disabled="!output.asset"
              :aria-label="output.asset ? `查看第 ${output.position} 张` : `第 ${output.position} 张处理中`"
              @click="selectOutput(output)"
            >
              <ProtectedImage
                v-if="output.asset"
                :asset-id="output.asset.id"
                :alt="`第 ${output.position} 张生成结果`"
                thumbnail
              />
              <span v-else class="output-strip__state">
                <LoaderCircle
                  v-if="['queued', 'running'].includes(output.status)"
                  class="spin"
                  :size="15"
                  aria-hidden="true"
                />
                <CircleAlert v-else :size="15" aria-hidden="true" />
              </span>
              <small>{{ String(output.position).padStart(2, '0') }}</small>
            </button>
          </div>

          <footer class="canvas-foot">
            <div>
              <CheckCircle2 v-if="activeStatus === 'succeeded'" :size="16" aria-hidden="true" />
              <CircleAlert
                v-else-if="activeStatus === 'failed' || stageError"
                :size="16"
                aria-hidden="true"
              />
              <Sparkles v-else :size="16" aria-hidden="true" />
              <span>{{ stageError ? submitError : statusHint }}</span>
            </div>
            <div v-if="selectedOutput?.asset" class="canvas-actions">
              <button
                type="button"
                class="icon-button"
                :aria-label="selectedOutput.asset.isFavorite ? '取消收藏' : '收藏作品'"
                :title="selectedOutput.asset.isFavorite ? '取消收藏' : '收藏作品'"
                :disabled="favoriteSaving"
                @click.stop="toggleFavorite"
              >
                <LoaderCircle v-if="favoriteSaving" class="spin" :size="16" aria-hidden="true" />
                <Heart
                  v-else
                  :size="17"
                  :fill="selectedOutput.asset.isFavorite ? 'currentColor' : 'none'"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="icon-button"
                aria-label="下载原图"
                title="下载原图"
                :disabled="downloading"
                @click.stop="downloadCurrent"
              >
                <LoaderCircle v-if="downloading" class="spin" :size="16" aria-hidden="true" />
                <Download v-else :size="17" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </article>
      </section>

      <aside class="control-rail" aria-label="创作设置">
        <section class="tool-card prompt-card" :class="{ 'compact-editor': stageVisible }">
          <template v-if="!stageVisible">
          <div class="card-heading">
            <h2>描述你想要的画面</h2>
            <span class="char-count">{{ prompt.length }} / 4000</span>
          </div>
          <textarea
            v-model="prompt"
            maxlength="4000"
            rows="5"
            placeholder="比如：一位穿白裙子的女孩站在窗边，午后的光很柔和……"
            aria-label="描述你想要的画面"
            :disabled="taskIsActive || submitting"
          />
          <div class="prompt-suggestions" aria-label="描述参考">
            <button
              v-for="(sample, index) in samplePrompts"
              :key="sample"
              type="button"
              :disabled="taskIsActive || submitting"
              @click="choosePrompt(sample)"
            >
              试试灵感 {{ index + 1 }}
            </button>
          </div>

          <div class="quick-settings">
            <label class="quick-control">
              <span>图片比例</span>
              <span class="select-wrap">
                <select
                  v-model="selectedAspectRatio"
                  aria-label="图片比例"
                  :disabled="taskIsActive || submitting"
                >
                  <option
                    v-for="ratio in aspectRatioOptions"
                    :key="ratio.value"
                    :value="ratio.value"
                    :disabled="ratio.value === 'original' && !originalRatioAvailable"
                  >
                    {{ ratio.label }} · {{ ratio.ratio }}
                  </option>
                </select>
                <ChevronDown :size="15" aria-hidden="true" />
              </span>
            </label>

            <div class="quick-control">
              <span>清晰度</span>
              <div class="resolution-toggle" role="radiogroup" aria-label="清晰度">
                <button
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  type="button"
                  role="radio"
                  :aria-checked="selectedResolution === option.value"
                  :class="{ 'is-selected': selectedResolution === option.value }"
                  :disabled="taskIsActive || submitting"
                  @click="selectedResolution = option.value"
                >
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.description }}</small>
                </button>
              </div>
            </div>

            <div class="quick-control">
              <span>生成几张</span>
              <div class="stepper" aria-label="生成几张">
                <button
                  type="button"
                  aria-label="减少生成张数"
                  :disabled="count <= 1 || taskIsActive || submitting"
                  @click="decrementCount"
                >
                  <Minus :size="15" aria-hidden="true" />
                </button>
                <strong>{{ count }}</strong>
                <button
                  type="button"
                  aria-label="增加生成张数"
                  :disabled="count >= 4 || taskIsActive || submitting"
                  @click="incrementCount"
                >
                  <Plus :size="15" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div class="prompt-action-row">
            <button
              type="button"
              class="advanced-toggle"
              :aria-expanded="advancedOpen"
              @click="advancedOpen = !advancedOpen"
            >
              <SlidersHorizontal :size="16" aria-hidden="true" />
              {{ advancedOpen ? '收起画面细节' : '画面细节' }}
              <ChevronDown :size="15" :class="{ 'is-open': advancedOpen }" aria-hidden="true" />
            </button>

            <div class="prompt-action-right">
              <span class="available-credit">可用 {{ availableCredits }} 积分</span>
              <button
                class="button button--primary prompt-generate"
                type="button"
                :disabled="!canSubmit"
                @click="submitGeneration"
              >
                <LoaderCircle
                  v-if="submitting || taskIsActive"
                  class="spin"
                  :size="17"
                  aria-hidden="true"
                />
                <Aperture v-else :size="17" aria-hidden="true" />
                <span v-if="submitting">正在准备</span>
                <span v-else-if="taskIsActive">正在绘制</span>
                <span v-else-if="publicSettings?.generationReady">开始生成</span>
                <span v-else>服务未连接</span>
                <strong>{{ totalCost }} 积分</strong>
              </button>
            </div>
          </div>
          <p v-if="submitError" class="inline-alert inline-alert--error prompt-error" role="alert">
            {{ submitError }}
          </p>
          <p class="prompt-footnote">按成功生成的图片计费，失败或超时会退回积分。</p>
          </template>
          <template v-else>
            <div class="compact-fields">
              <label class="compact-prompt">
                <span class="visually-hidden">图片描述</span>
                <input
                  v-model="prompt"
                  maxlength="4000"
                  aria-label="图片描述"
                  placeholder="继续描述你想修改的画面"
                  :disabled="taskIsActive || submitting"
                />
              </label>

              <label class="compact-select-wrap">
                <span class="visually-hidden">图片比例</span>
                <select
                  v-model="selectedAspectRatio"
                  aria-label="紧凑图片比例"
                  :disabled="taskIsActive || submitting"
                >
                  <option
                    v-for="ratio in aspectRatioOptions"
                    :key="ratio.value"
                    :value="ratio.value"
                    :disabled="ratio.value === 'original' && !originalRatioAvailable"
                  >
                    {{ ratio.label }} {{ ratio.ratio }}
                  </option>
                </select>
                <ChevronDown :size="14" aria-hidden="true" />
              </label>

              <div class="compact-resolution" role="radiogroup" aria-label="紧凑清晰度">
                <button
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  type="button"
                  role="radio"
                  :aria-checked="selectedResolution === option.value"
                  :class="{ 'is-selected': selectedResolution === option.value }"
                  :disabled="taskIsActive || submitting"
                  @click="selectedResolution = option.value"
                >
                  {{ option.label }}
                </button>
              </div>

              <div class="compact-count" aria-label="生成张数">
                <button
                  type="button"
                  aria-label="减少生成张数"
                  :disabled="count <= 1 || taskIsActive || submitting"
                  @click="decrementCount"
                >
                  <Minus :size="13" aria-hidden="true" />
                </button>
                <span>{{ count }} 张</span>
                <button
                  type="button"
                  aria-label="增加生成张数"
                  :disabled="count >= 4 || taskIsActive || submitting"
                  @click="incrementCount"
                >
                  <Plus :size="13" aria-hidden="true" />
                </button>
              </div>

              <span class="compact-cost">可用 {{ availableCredits }} 积分</span>
            </div>

            <div class="compact-actions">
              <button
                type="button"
                class="button button--primary compact-generate"
                :disabled="!canSubmit"
                @click="submitGeneration"
              >
                <LoaderCircle
                  v-if="submitting || taskIsActive"
                  class="spin"
                  :size="15"
                  aria-hidden="true"
                />
                <Aperture v-else :size="15" aria-hidden="true" />
                <span v-if="submitting">准备中</span>
                <span v-else-if="taskIsActive">绘制中</span>
                <span v-else>再画一张</span>
                <strong>{{ totalCost }} 积分</strong>
              </button>
              <button
                type="button"
                class="compact-reset"
                aria-label="新生成"
                :disabled="taskIsActive || submitting"
                @click="startNewGeneration"
              >
                <RotateCcw :size="15" aria-hidden="true" />
                <span>新生成</span>
              </button>
            </div>
          </template>
        </section>

        <section v-if="!stageVisible && mode === 'edit'" class="tool-card reference-card">
          <div class="card-heading">
            <h2>添加参考图</h2>
            <span class="char-count">{{ references.length }} / 4</span>
          </div>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            :disabled="taskIsActive || submitting"
            @change="handleFiles"
          />
          <div class="reference-grid">
            <div v-for="reference in references" :key="reference.id" class="reference-item">
              <img :src="reference.url" :alt="reference.file.name" />
              <button
                type="button"
                :aria-label="`移除 ${reference.file.name}`"
                :title="`移除 ${reference.file.name}`"
                :disabled="taskIsActive || submitting"
                @click="removeReference(reference.id)"
              >
                <X :size="14" aria-hidden="true" />
              </button>
            </div>
            <button
              v-if="references.length < 4"
              type="button"
              class="reference-add"
              :disabled="taskIsActive || submitting"
              @click="openFilePicker"
            >
              <Upload :size="18" aria-hidden="true" />
              <span>添加图片</span>
            </button>
          </div>
          <p class="card-note">支持 PNG、JPEG、WebP，单张不超过 10 MB</p>
          <p v-if="uploadError" class="field-error" role="alert">{{ uploadError }}</p>
        </section>

        <Transition v-if="!stageVisible" name="advanced">
          <section v-if="advancedOpen" class="tool-card parameters-card">
            <div class="card-heading">
              <h2>画面细节</h2>
              <SlidersHorizontal :size="17" aria-hidden="true" />
            </div>

            <div class="detail-options">
              <label class="parameter-block">
                <span class="parameter-label">画面质量</span>
                <span class="select-wrap">
                  <select v-model="quality" :disabled="taskIsActive || submitting">
                    <option
                      v-for="option in qualityOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <ChevronDown :size="16" aria-hidden="true" />
                </span>
              </label>

              <label class="parameter-block">
                <span class="parameter-label">背景</span>
                <span class="select-wrap">
                  <select v-model="background" :disabled="taskIsActive || submitting">
                    <option
                      v-for="option in backgroundOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <ChevronDown :size="16" aria-hidden="true" />
                </span>
              </label>
            </div>
          </section>
        </Transition>

      </aside>

    </div>

    <dialog ref="previewDialog" class="image-dialog" @click="closeDialogFromBackdrop">
      <div class="image-dialog__bar">
        <div>
          <strong>作品预览</strong>
          <span v-if="selectedOutput?.asset">
            {{ selectedOutput.asset.width }} × {{ selectedOutput.asset.height }} · PNG
          </span>
        </div>
        <button type="button" class="icon-button" aria-label="关闭预览" @click="closePreview">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
      <ProtectedImage
        v-if="selectedOutput?.asset"
        :asset-id="selectedOutput.asset.id"
        :alt="activeGeneration?.prompt || '生成结果'"
        class="dialog-result-image"
      />
      <div class="image-dialog__note">
        <Info :size="16" aria-hidden="true" />
        <span v-if="selectedOutput?.asset">
          {{ statusHint }} · 保留至
          {{ new Date(selectedOutput.asset.expiresAt).toLocaleString('zh-CN') }}
        </span>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.studio-page {
  width: min(1540px, calc(100% - 40px));
  margin: 10px auto 34px;
}

.studio-toolbar {
  display: grid;
  min-height: 48px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin-bottom: 10px;
}

.mode-switch {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface-muted);
}

.mode-switch button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.mode-switch button.is-active {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
}

.workspace-status {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}

.status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 15%, transparent);
}

.status-dot--ready {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 15%, transparent);
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
}

.studio-layout {
  display: grid;
  grid-template-columns: 314px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}

.control-rail {
  position: sticky;
  top: 78px;
  display: flex;
  max-height: calc(100svh - 90px);
  flex-direction: column;
  gap: 9px;
  overflow: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.mobile-rail-head {
  display: none;
}

.tool-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: 0 7px 22px color-mix(in srgb, var(--shadow-color) 55%, transparent);
}

.prompt-card,
.reference-card,
.parameters-card {
  padding: 14px;
}

.prompt-card {
  border-color: color-mix(in srgb, var(--action) 28%, var(--line));
}

.reference-card {
  border-color: var(--line);
}

.parameters-card {
  border-color: var(--line);
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.card-heading > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.card-index {
  color: var(--action);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
}

.card-heading h2,
.contact-head h2 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.char-count,
.parameter-label,
.card-note {
  color: var(--muted);
  font-size: 10px;
}

.prompt-card textarea {
  width: 100%;
  min-height: 134px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.7;
  transition: border-color 180ms var(--ease-out);
}

.prompt-card textarea:focus {
  border-color: var(--action);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.prompt-card textarea::placeholder {
  color: var(--muted-soft);
}

.prompt-suggestions {
  display: flex;
  gap: 6px;
  margin-top: 9px;
}

.prompt-suggestions button {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 10px;
}

.prompt-suggestions button:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.reference-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.reference-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
}

.reference-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reference-item button {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: rgb(15 18 17 / 72%);
  color: #fff;
  cursor: pointer;
}

.reference-add {
  display: flex;
  aspect-ratio: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  font-size: 9px;
}

.reference-add:hover {
  border-color: var(--action);
  color: var(--action);
}

.card-note {
  margin: 8px 0 0;
  line-height: 1.5;
}

.parameters-card {
  display: grid;
  gap: 13px;
}

.parameters-card .card-heading {
  margin-bottom: 0;
}

.parameter-block {
  display: grid;
  gap: 7px;
}

.size-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.size-options button {
  display: flex;
  min-width: 0;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 7px 4px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  transition:
    border-color 180ms var(--ease-out),
    color 180ms var(--ease-out),
    background 180ms var(--ease-out);
}

.size-options button.is-selected {
  border-color: var(--action);
  background: var(--action-soft);
  color: var(--action);
}

.size-options button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.size-options button span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.size-options strong {
  color: inherit;
  font-size: 10px;
  font-weight: 500;
}

.size-options small {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.size-shape {
  display: block;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.size-shape--square {
  width: 15px;
  height: 15px;
}

.size-shape--landscape {
  width: 18px;
  height: 12px;
}

.size-shape--portrait {
  width: 12px;
  height: 18px;
}

.size-shape--wide {
  width: 19px;
  height: 11px;
}

.size-shape--tall {
  width: 11px;
  height: 19px;
}

.size-shape--classic {
  width: 17px;
  height: 13px;
}

.size-shape--classic-portrait {
  width: 13px;
  height: 17px;
}

.size-shape--ultra-wide {
  width: 21px;
  height: 9px;
}

.size-shape--ultra-tall {
  width: 9px;
  height: 21px;
}

.size-shape--original {
  width: 15px;
  height: 15px;
  border-style: dashed;
}

.select-wrap {
  position: relative;
  display: block;
}

.select-wrap select {
  width: 100%;
  height: 40px;
  appearance: none;
  padding: 0 36px 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}

.select-wrap svg {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.count-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.resolution-block {
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-muted);
}

.resolution-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.resolution-heading strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
}

.resolution-slider {
  display: grid;
  gap: 3px;
}

.resolution-slider input[type='range'] {
  width: 100%;
  height: 20px;
  margin: 0;
  accent-color: var(--action);
  cursor: pointer;
}

.resolution-marks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.resolution-marks button {
  display: grid;
  min-width: 0;
  gap: 1px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    color 180ms var(--ease-out);
}

.resolution-marks button.is-active {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
}

.resolution-marks strong {
  color: inherit;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 500;
}

.resolution-marks small {
  overflow: hidden;
  color: var(--muted);
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resolution-marks span {
  color: var(--action);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.stepper {
  display: inline-grid;
  grid-template-columns: 30px 34px 30px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
}

.stepper button {
  display: grid;
  width: 30px;
  height: 32px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.stepper button:disabled {
  cursor: not-allowed;
  opacity: 0.36;
}

.stepper strong {
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  font-weight: 500;
}

.estimate-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
}

.estimate-row > div {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.estimate-row span {
  color: var(--muted);
  font-size: 10px;
}

.estimate-row strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 17px;
  font-weight: 500;
}

.estimate-row strong small {
  color: var(--muted);
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 10px;
  font-weight: 400;
}

.generate-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.rail-footnote {
  margin: -1px 4px 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.6;
  text-align: center;
}

.workspace {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.canvas-card {
  display: flex;
  min-height: 638px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--shadow-color) 50%, transparent);
  border-color: var(--line);
}

.canvas-head {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--line);
}

.canvas-head > div {
  display: flex;
  align-items: center;
  gap: 14px;
}

.canvas-live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 500;
}

.canvas-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning);
}

.canvas-live i.is-processing {
  background: var(--action);
  animation: status-pulse 1.4s var(--ease-out) infinite;
}

.canvas-live i.is-error {
  background: var(--warning);
}

.canvas-size {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.canvas-frame {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 0;
  flex: 1;
  place-items: center;
  overflow: hidden;
  padding: clamp(18px, 3vw, 42px);
  border: 0;
  background-color: var(--canvas-bg);
  background-image:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
  background-size: 22px 22px;
  cursor: zoom-in;
}

.canvas-frame img {
  width: min(100%, 720px);
  max-height: 500px;
  aspect-ratio: var(--canvas-ratio);
  object-fit: cover;
  border-radius: var(--radius-thumb);
  box-shadow: 0 18px 44px rgb(0 0 0 / 20%);
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.canvas-frame :deep(.protected-image) {
  width: min(100%, 720px);
  height: auto;
  max-height: 500px;
  aspect-ratio: var(--canvas-ratio);
  border-radius: var(--radius-thumb);
  object-fit: cover;
  box-shadow: 0 18px 44px rgb(0 0 0 / 20%);
}

.canvas-frame:hover img {
  transform: scale(0.998);
}

.canvas-preview-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 5px 8px;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  background: rgb(15 18 17 / 72%);
  color: #f4f3ee;
  font-size: 9px;
  backdrop-filter: blur(10px);
}

.canvas-frame__meta {
  position: absolute;
  right: 18px;
  bottom: 14px;
  display: flex;
  gap: 8px;
}

.canvas-frame__meta span {
  padding: 4px 7px;
  border-radius: 8px;
  background: rgb(15 18 17 / 74%);
  color: #e8e5dc;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  backdrop-filter: blur(8px);
}

.canvas-task-state {
  display: flex;
  width: min(100%, 560px);
  min-height: 300px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--muted);
  text-align: center;
}

.canvas-task-state strong {
  color: var(--ink);
  font-size: 18px;
  font-weight: 550;
}

.canvas-task-state > span:not(.canvas-task-mark) {
  max-width: 42ch;
  font-size: 11px;
  line-height: 1.7;
}

.canvas-task-state--error .canvas-task-mark {
  color: var(--warning);
}

.canvas-task-mark {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 6px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--action);
}

.task-progress {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.task-progress i {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  font-style: normal;
}

.task-progress i.is-done {
  border-color: color-mix(in srgb, var(--success) 46%, var(--line));
  background: color-mix(in srgb, var(--success) 10%, var(--surface));
  color: var(--success);
}

.task-progress i.is-error {
  border-color: color-mix(in srgb, var(--warning) 46%, var(--line));
  color: var(--warning);
}

.output-strip {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  overflow-x: auto;
  border-top: 1px solid var(--line);
  background: var(--surface-muted);
}

.output-strip button {
  position: relative;
  display: grid;
  width: 58px;
  height: 48px;
  flex: 0 0 58px;
  place-items: center;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.output-strip button.is-selected {
  border-color: var(--action);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.output-strip button:disabled {
  cursor: wait;
}

.output-strip small {
  position: absolute;
  right: 3px;
  bottom: 2px;
  padding: 1px 3px;
  border-radius: 3px;
  background: rgb(10 13 12 / 66%);
  color: #fff;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.output-strip__state {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: var(--surface-muted);
}

.canvas-foot {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.canvas-foot div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.canvas-actions {
  display: flex;
  gap: 2px;
}

.canvas-actions .icon-button {
  width: 30px;
  height: 30px;
  flex-basis: 30px;
}

.contact-sheet {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.contact-head {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-muted);
}

.contact-head > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.contact-head a {
  color: var(--muted);
  font-size: 10px;
  text-decoration: none;
}

.contact-head a:hover {
  color: var(--action);
}

.contact-empty {
  display: grid;
  min-height: 112px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  padding: 12px;
}

.recent-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 120ms var(--ease-out),
    transform 90ms ease-out;
}

.recent-card:hover {
  border-color: var(--line-strong);
}

.recent-card:active {
  transform: scale(0.98);
}

.recent-card__image {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.recent-card__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding: 7px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.recent-card__meta svg {
  flex: 0 0 auto;
  color: var(--warning);
}

.contact-empty__mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
  color: var(--muted);
}

.contact-empty strong {
  color: var(--ink);
  font-size: 12px;
  font-weight: 500;
}

.contact-empty p {
  max-width: 52ch;
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}

.contact-slots {
  display: flex;
  gap: 4px;
}

.contact-slots span {
  display: grid;
  width: 34px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--muted-soft);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.mobile-action-bar {
  display: none;
}

.controls-backdrop {
  display: none;
}

.image-dialog {
  width: min(1120px, calc(100vw - 28px));
  max-width: none;
  max-height: calc(100svh - 28px);
  padding: 0;
  overflow: auto;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 28px 90px rgb(0 0 0 / 42%);
}

.image-dialog::backdrop {
  background: rgb(8 11 10 / 82%);
  backdrop-filter: blur(8px);
}

.image-dialog__bar {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid var(--line);
}

.image-dialog__bar div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.image-dialog__bar strong {
  font-size: 13px;
}

.image-dialog__bar span {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.image-dialog > img {
  display: block;
  width: 100%;
  max-height: calc(100svh - 150px);
  object-fit: contain;
  background: #0b0d0c;
}

.image-dialog :deep(.dialog-result-image) {
  display: block;
  width: 100%;
  max-height: calc(100svh - 150px);
  object-fit: contain;
  background: #0b0d0c;
}

.image-dialog__note {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  color: var(--muted);
  font-size: 10px;
}

.spin {
  animation: studio-spin 800ms linear infinite;
}

@keyframes studio-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 1120px) {
  .studio-page {
    width: min(100% - 20px, 1200px);
  }

  .studio-layout {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .canvas-card {
    min-height: 570px;
  }

  .contact-empty {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .recent-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .contact-slots {
    display: none;
  }
}

@media (max-width: 900px) {
  .studio-page {
    width: min(100% - 20px, 760px);
    margin-top: 8px;
    padding-bottom: 82px;
  }

  .studio-toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .workspace-status {
    grid-row: 2;
    grid-column: 1 / -1;
    padding: 0 2px 2px;
  }

  .toolbar-meta {
    grid-column: 2;
    grid-row: 1;
  }

  .studio-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace {
    display: flex;
    flex-direction: column;
  }

  .canvas-card {
    order: -1;
    min-height: 0;
  }

  .canvas-frame {
    min-height: 340px;
    padding: 22px;
  }

  .canvas-frame img {
    width: min(100%, 540px);
    max-height: 430px;
  }

  .canvas-frame :deep(.protected-image) {
    width: min(100%, 540px);
    max-height: 430px;
  }

  .control-rail {
    position: fixed;
    z-index: 80;
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    max-height: 88svh;
    overflow: auto;
    padding: 14px 14px max(18px, env(safe-area-inset-bottom));
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 16px 16px 0 0;
    background: var(--bg);
    box-shadow: 0 -22px 60px rgb(0 0 0 / 28%);
    transform: translateY(105%);
    transition: transform 220ms var(--ease-out);
  }

  .control-rail.is-open {
    transform: translateY(0);
  }

  .mobile-rail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px 3px;
  }

  .mobile-rail-head div {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }

  .mobile-rail-head strong {
    font-size: 16px;
  }

  .mobile-rail-head span {
    color: var(--muted);
    font-size: 10px;
  }

  .controls-backdrop {
    position: fixed;
    z-index: 70;
    inset: 0;
    display: block;
    background: rgb(6 9 8 / 55%);
    backdrop-filter: blur(2px);
  }

  .mobile-action-bar {
    position: fixed;
    z-index: 200;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    min-height: 72px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 12px max(10px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(18px);
  }

  .mobile-edit-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    gap: 6px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface-muted);
    color: var(--ink);
    font-size: 11px;
  }

  .mobile-estimate {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .mobile-estimate span {
    color: var(--muted);
    font-size: 9px;
  }

  .mobile-estimate strong {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 500;
  }

  .mobile-action-bar .button {
    min-height: 42px;
  }
}

@media (max-width: 560px) {
  .studio-page {
    width: calc(100% - 16px);
  }

  .toolbar-meta span:first-child {
    display: none;
  }

  .canvas-head {
    min-height: 46px;
  }

  .canvas-size {
    display: none;
  }

  .canvas-frame {
    min-height: 310px;
    padding: 16px;
  }

  .canvas-frame img {
    max-height: 390px;
  }

  .canvas-frame__meta {
    right: 10px;
    bottom: 10px;
  }

  .canvas-preview-badge {
    top: 10px;
    left: 10px;
  }

  .canvas-foot {
    padding: 0 12px;
  }

  .canvas-foot > span {
    display: none;
  }

  .contact-head {
    padding: 0 12px;
  }

  .contact-empty {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .contact-empty__mark {
    width: 40px;
    height: 40px;
  }

  .image-dialog {
    width: calc(100vw - 12px);
    max-height: calc(100svh - 12px);
  }

  .recent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Big-input-first studio flow */
.studio-page {
  width: min(1240px, calc(100% - 40px));
  margin: 28px auto 76px;
  padding-bottom: 0;
}

.studio-hero {
  display: grid;
  width: min(820px, 100%);
  justify-items: center;
  gap: 18px;
  margin: 0 auto 18px;
  text-align: center;
  transition:
    width 260ms var(--ease-out),
    margin 260ms var(--ease-out);
}

.studio-hero__copy {
  min-width: 0;
}

.studio-hero h1 {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(42px, 6vw, 70px);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.04;
}

.studio-hero p {
  max-width: 48ch;
  margin: 13px auto 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.75;
}

.studio-page--creating .studio-hero {
  width: min(1060px, 100%);
  grid-template-columns: minmax(0, 1fr) auto;
  justify-items: stretch;
  align-items: end;
  gap: 20px;
  margin-top: 18px;
  text-align: left;
}

.studio-page--creating .studio-hero h1 {
  font-size: clamp(34px, 4.5vw, 50px);
}

.studio-page--creating .studio-hero p {
  max-width: 56ch;
  margin: 8px 0 0;
  font-size: 12px;
}

.studio-hero__status {
  display: inline-flex;
  min-height: 36px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.studio-hero__status i,
.canvas-live i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--muted-soft);
}

.studio-hero__status i.is-active,
.canvas-live i.is-processing {
  background: var(--action);
  animation: status-pulse 1.4s var(--ease-out) infinite;
}

.studio-hero__status i.is-ready,
.canvas-live i.is-ready {
  background: var(--success);
}

.studio-hero__status i.is-error,
.canvas-live i.is-error {
  background: var(--warning);
}

.status-fade-enter-active,
.status-fade-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.status-fade-enter-from,
.status-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.studio-toolbar {
  display: grid;
  width: min(820px, 100%);
  min-height: 48px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin: 0 auto 14px;
  padding: 0;
  transition: width 260ms var(--ease-out);
}

.studio-page--creating .studio-toolbar {
  width: min(1060px, 100%);
}

.mode-switch {
  display: inline-flex;
  gap: 3px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface-muted);
}

.mode-switch button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition:
    border-color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    color 180ms var(--ease-out),
    transform 90ms ease-out;
}

.mode-switch button:hover:not(:disabled) {
  color: var(--ink);
}

.mode-switch button.is-active {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-soft);
}

.mode-switch button:active:not(:disabled) {
  transform: scale(0.97);
}

.workspace-status {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}

.status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 12%, transparent);
}

.status-dot--ready {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 12%, transparent);
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.studio-layout {
  display: grid;
  width: min(820px, 100%);
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  margin: 0 auto;
}

.studio-layout.is-creating {
  width: min(1060px, 100%);
  grid-template-areas:
    'stage'
    'editor';
  gap: 22px;
}

.workspace {
  display: grid;
  min-width: 0;
  grid-area: stage;
  gap: 10px;
  scroll-margin-top: 84px;
  animation: studio-stage-enter 440ms var(--ease-out) both;
}

.control-rail {
  position: static;
  display: grid;
  width: 100%;
  max-height: none;
  z-index: auto;
  gap: 14px;
  overflow: visible;
  padding: 0;
  scroll-margin-top: 80px;
}

.studio-layout.is-creating .control-rail {
  grid-area: editor;
}

.tool-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.prompt-card,
.reference-card,
.parameters-card {
  padding: 24px;
}

.prompt-card {
  border-color: var(--line);
}

.reference-card,
.parameters-card {
  border-color: var(--line);
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
}

.char-count,
.parameter-label,
.card-note {
  color: var(--muted);
  font-size: 10px;
}

.prompt-card textarea {
  width: 100%;
  min-height: 210px;
  resize: vertical;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  line-height: 1.75;
  transition:
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out),
    background-color 180ms var(--ease-out);
}

.studio-page--creating .prompt-card textarea {
  min-height: 142px;
}

.prompt-card textarea:hover:not(:disabled) {
  border-color: var(--line-strong);
}

.prompt-card textarea:focus {
  border-color: var(--action);
  background: var(--surface);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.prompt-card textarea::placeholder {
  color: var(--muted-soft);
}

.prompt-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}

.prompt-suggestions button,
.advanced-toggle {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control-sm);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-size: 10px;
  transition:
    border-color 160ms var(--ease-out),
    background-color 160ms var(--ease-out),
    color 160ms var(--ease-out),
    transform 90ms ease-out;
}

.prompt-suggestions button:hover:not(:disabled),
.advanced-toggle:hover {
  border-color: var(--line-strong);
  background: var(--surface-hover);
  color: var(--ink);
}

.prompt-suggestions button:active:not(:disabled),
.advanced-toggle:active {
  transform: scale(0.97);
}

.quick-settings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.quick-control {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.quick-control > span:first-child {
  color: var(--muted);
  font-size: 10px;
}

.select-wrap {
  position: relative;
  display: block;
}

.select-wrap select {
  width: 100%;
  height: 42px;
  appearance: none;
  padding: 0 36px 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  transition:
    border-color 180ms var(--ease-out),
    box-shadow 180ms var(--ease-out);
}

.select-wrap select:focus {
  border-color: var(--action);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.select-wrap svg {
  position: absolute;
  top: 50%;
  right: 12px;
  color: var(--muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.resolution-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  min-height: 42px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
}

.resolution-toggle button {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  padding: 0 5px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    border-color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    color 180ms var(--ease-out),
    transform 90ms ease-out;
}

.resolution-toggle button:active:not(:disabled) {
  transform: scale(0.97);
}

.resolution-toggle button.is-selected {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-soft);
}

.resolution-toggle strong {
  font-size: 11px;
  font-weight: 600;
}

.resolution-toggle small {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stepper {
  display: inline-grid;
  min-height: 42px;
  grid-template-columns: 34px 38px 34px;
  align-items: center;
  justify-self: start;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
}

.stepper button {
  display: grid;
  width: 34px;
  height: 40px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background-color 150ms var(--ease-out),
    color 150ms var(--ease-out),
    transform 90ms ease-out;
}

.stepper button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--ink);
}

.stepper button:active:not(:disabled) {
  transform: scale(0.9);
}

.stepper strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
}

.advanced-toggle svg:last-child {
  transition: transform 180ms var(--ease-out);
}

.advanced-toggle svg:last-child.is-open {
  transform: rotate(180deg);
}

.advanced-enter-active,
.advanced-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.advanced-enter-from,
.advanced-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.reference-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.reference-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
}

.reference-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reference-item button {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgb(20 21 24 / 70%);
  color: #fff;
  cursor: pointer;
}

.reference-add {
  display: flex;
  aspect-ratio: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  font-size: 9px;
  transition:
    border-color 160ms var(--ease-out),
    color 160ms var(--ease-out),
    transform 90ms ease-out;
}

.reference-add:hover:not(:disabled) {
  border-color: var(--action);
  color: var(--action);
}

.reference-add:active:not(:disabled) {
  transform: scale(0.97);
}

.card-note {
  margin: 9px 0 0;
  line-height: 1.55;
}

.parameters-card {
  display: grid;
  gap: 16px;
}

.detail-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.parameters-card .card-heading {
  margin-bottom: 0;
}

.parameter-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.size-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.size-options button {
  display: flex;
  min-width: 0;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 5px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  transition:
    border-color 180ms var(--ease-out),
    color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    transform 90ms ease-out;
}

.size-options button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--ink);
}

.size-options button:active:not(:disabled) {
  transform: scale(0.97);
}

.size-options button.is-selected {
  border-color: var(--action);
  background: var(--action-soft);
  color: var(--action);
}

.size-options button span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.size-options strong {
  color: inherit;
  font-size: 10px;
  font-weight: 500;
}

.size-options small {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.size-shape {
  display: block;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.size-shape--square {
  width: 15px;
  height: 15px;
}

.size-shape--landscape {
  width: 18px;
  height: 12px;
}

.size-shape--portrait {
  width: 12px;
  height: 18px;
}

.size-shape--wide {
  width: 19px;
  height: 11px;
}

.size-shape--tall {
  width: 11px;
  height: 19px;
}

.size-shape--classic {
  width: 17px;
  height: 13px;
}

.size-shape--classic-portrait {
  width: 13px;
  height: 17px;
}

.size-shape--ultra-wide {
  width: 21px;
  height: 9px;
}

.size-shape--ultra-tall {
  width: 9px;
  height: 21px;
}

.size-shape--original {
  width: 15px;
  height: 15px;
  border-style: dashed;
}

.resolution-block {
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
}

.resolution-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.resolution-heading strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
}

.resolution-slider {
  display: grid;
  gap: 5px;
}

.resolution-slider input[type='range'] {
  width: 100%;
  height: 20px;
  margin: 0;
  accent-color: var(--action);
  cursor: pointer;
}

.resolution-marks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.resolution-marks button {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding: 8px 5px;
  border: 1px solid transparent;
  border-radius: var(--radius-control-sm);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    color 180ms var(--ease-out);
}

.resolution-marks button.is-active {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
}

.resolution-marks strong {
  color: inherit;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 500;
}

.resolution-marks small {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resolution-marks span {
  color: var(--action);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.action-dock {
  display: grid;
  gap: 10px;
}

.estimate-row {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-thumb);
  background: var(--surface-muted);
}

.estimate-row > div {
  display: flex;
  align-items: baseline;
  gap: 11px;
}

.estimate-row span {
  color: var(--muted);
  font-size: 10px;
}

.estimate-row strong {
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 19px;
  font-weight: 500;
}

.estimate-row strong small {
  color: var(--muted);
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 10px;
  font-weight: 400;
}

.generate-button {
  min-height: 50px;
  font-size: 13px;
}

.generate-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}

.rail-footnote {
  margin: 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.6;
  text-align: center;
}

.canvas-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.canvas-head {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px 0 20px;
  border-bottom: 1px solid var(--line);
}

.canvas-head__copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.canvas-live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 550;
}

.canvas-size {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.canvas-frame {
  position: relative;
  display: grid;
  width: 100%;
  min-height: clamp(380px, 56svh, 650px);
  place-items: center;
  overflow: hidden;
  padding: clamp(18px, 4vw, 42px);
  border: 0;
  background: var(--canvas-bg);
  cursor: zoom-in;
}

.canvas-frame:disabled {
  cursor: default;
  opacity: 1;
}

.canvas-frame.is-result:hover .canvas-media {
  transform: scale(0.997);
}

.canvas-media {
  display: block;
  width: min(100%, 960px, calc(min(62svh, 680px) * var(--canvas-aspect)));
  aspect-ratio: var(--canvas-ratio);
  overflow: hidden;
  border-radius: var(--radius-thumb);
  background: color-mix(in srgb, var(--surface) 50%, var(--surface-muted));
  box-shadow:
    0 1px 2px rgb(35 37 42 / 8%),
    0 16px 38px rgb(35 37 42 / 12%);
  transition: transform 180ms var(--ease-out);
}

.canvas-media :deep(.protected-image) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.canvas-media :deep(.protected-image-state) {
  width: 100%;
  height: 100%;
}

.canvas-task-state {
  display: flex;
  width: min(100%, 620px);
  min-height: 360px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
}

.canvas-task-state > strong {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 560;
}

.canvas-task-state > span:not(.canvas-task-mark) {
  max-width: 46ch;
  font-size: 11px;
  line-height: 1.7;
}

.canvas-task-mark {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--action);
  box-shadow: var(--shadow-soft);
}

.canvas-task-state--error .canvas-task-mark {
  color: var(--warning);
}

.render-steps {
  display: grid;
  width: min(100%, 460px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.render-steps li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 8px;
}

.render-steps li:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: 13px;
  left: calc(50% + 18px);
  width: calc(100% - 36px);
  height: 1px;
  background: var(--line);
  content: '';
}

.render-steps li.is-complete:not(:last-child)::after {
  background: color-mix(in srgb, var(--success) 50%, var(--line));
}

.render-steps li > span {
  position: relative;
  z-index: 1;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
}

.render-steps li > strong {
  color: var(--muted);
  font-size: 9px;
  font-weight: 500;
}

.render-steps li.is-current > span {
  border-color: var(--action);
  background: var(--action);
  color: #fff;
}

.render-steps li.is-current > strong {
  color: var(--ink);
}

.render-steps li.is-complete > span {
  border-color: color-mix(in srgb, var(--success) 45%, var(--line));
  background: color-mix(in srgb, var(--success) 10%, var(--surface));
  color: var(--success);
}

.task-progress {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin-top: 6px;
}

.task-progress i {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  font-style: normal;
}

.task-progress i.is-done {
  border-color: color-mix(in srgb, var(--success) 45%, var(--line));
  color: var(--success);
}

.task-progress i.is-error {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--line));
  color: var(--warning);
}

.output-strip {
  display: flex;
  gap: 7px;
  padding: 10px 14px;
  overflow-x: auto;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.output-strip button {
  position: relative;
  display: grid;
  width: 62px;
  height: 52px;
  flex: 0 0 62px;
  place-items: center;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface-muted);
  color: var(--muted);
  cursor: pointer;
  transition:
    border-color 140ms var(--ease-out),
    box-shadow 140ms var(--ease-out),
    transform 90ms ease-out;
}

.output-strip button:active:not(:disabled) {
  transform: scale(0.96);
}

.output-strip button.is-selected {
  border-color: var(--action);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.output-strip button:disabled {
  cursor: wait;
}

.output-strip small {
  position: absolute;
  right: 3px;
  bottom: 2px;
  padding: 1px 3px;
  border-radius: 4px;
  background: rgb(20 21 24 / 66%);
  color: #fff;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
}

.output-strip__state {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: var(--surface-muted);
}

.canvas-foot {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 16px 0 20px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.canvas-foot > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.canvas-foot > div > span {
  max-width: 70ch;
  line-height: 1.5;
}

.canvas-actions {
  flex: 0 0 auto;
}

.canvas-actions .icon-button {
  width: 32px;
  height: 32px;
  flex-basis: 32px;
}

.image-dialog {
  width: min(1120px, calc(100vw - 28px));
  max-width: none;
  max-height: calc(100svh - 28px);
  padding: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 28px 90px rgb(0 0 0 / 28%);
}

.image-dialog::backdrop {
  background: rgb(20 21 24 / 78%);
  backdrop-filter: blur(8px);
}

.image-dialog__bar {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 20px;
  border-bottom: 1px solid var(--line);
}

.image-dialog__bar div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.image-dialog__bar strong {
  font-size: 13px;
}

.image-dialog__bar span {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
}

.image-dialog :deep(.dialog-result-image) {
  display: block;
  width: 100%;
  max-height: calc(100svh - 154px);
  object-fit: contain;
  background: var(--canvas-bg);
}

.image-dialog__note {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  color: var(--muted);
  font-size: 10px;
}

.mobile-action-bar {
  display: none;
}

.spin {
  animation: studio-spin 800ms linear infinite;
}

@keyframes studio-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

@keyframes studio-stage-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .studio-page {
    width: min(100% - 20px, 760px);
    margin-top: 20px;
    padding-bottom: 88px;
  }

  .studio-page--creating .studio-hero {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .studio-hero__status {
    justify-self: start;
  }

  .studio-toolbar,
  .studio-page--creating .studio-toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .workspace-status {
    grid-column: 1 / -1;
    grid-row: 2;
    padding: 0 2px 2px;
  }

  .toolbar-meta {
    grid-column: 2;
    grid-row: 1;
  }

  .studio-layout,
  .studio-layout.is-creating {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }

  .control-rail {
    position: static;
    max-height: none;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    transform: none;
  }

  .size-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .canvas-frame {
    min-height: 390px;
  }

  .mobile-action-bar {
    position: fixed;
    z-index: 200;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    min-height: 72px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 12px max(10px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 93%, transparent);
    backdrop-filter: blur(18px);
    isolation: isolate;
    transform: translateZ(0);
  }

  .mobile-edit-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface-muted);
    color: var(--ink);
    cursor: pointer;
    font-size: 11px;
  }

  .mobile-estimate {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .mobile-estimate span {
    color: var(--muted);
    font-size: 9px;
  }

  .mobile-estimate strong {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 500;
  }

  .mobile-action-bar .button {
    min-height: 42px;
  }
}

@media (max-width: 620px) {
  .studio-page {
    width: calc(100% - 16px);
    margin-top: 18px;
  }

  .studio-hero h1 {
    font-size: 42px;
  }

  .studio-page--creating .studio-hero h1 {
    font-size: 34px;
  }

  .studio-hero p {
    font-size: 12px;
  }

  .studio-toolbar,
  .studio-page--creating .studio-toolbar {
    grid-template-columns: 1fr;
  }

  .mode-switch {
    width: 100%;
  }

  .mode-switch button {
    flex: 1;
    justify-content: center;
  }

  .toolbar-meta {
    display: none;
  }

  .workspace-status {
    grid-column: 1;
    grid-row: 2;
  }

  .prompt-card,
  .reference-card,
  .parameters-card {
    padding: 18px;
  }

  .prompt-card textarea,
  .studio-page--creating .prompt-card textarea {
    min-height: 168px;
    padding: 14px;
    font-size: 15px;
  }

  .quick-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 10px;
  }

  .quick-settings .quick-control:last-child {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    justify-content: space-between;
  }

  .size-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-options {
    grid-template-columns: 1fr;
  }

  .reference-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .canvas-head {
    min-height: 50px;
    padding: 0 10px 0 14px;
  }

  .canvas-head__copy {
    gap: 8px;
  }

  .canvas-size {
    display: none;
  }

  .canvas-frame {
    min-height: 300px;
    padding: 14px;
  }

  .canvas-task-state {
    min-height: 280px;
  }

  .canvas-task-state > strong {
    font-size: 20px;
  }

  .render-steps {
    width: 100%;
  }

  .canvas-media {
    width: 100%;
  }

  .canvas-foot {
    min-height: 44px;
    padding: 0 10px 0 14px;
  }

  .canvas-foot > div > span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .output-strip {
    padding: 8px 10px;
  }

  .image-dialog {
    width: calc(100vw - 12px);
    max-height: calc(100svh - 12px);
  }

  .image-dialog__bar {
    min-height: 52px;
    padding: 0 10px 0 14px;
  }

  .image-dialog__bar span {
    display: none;
  }
}

@media (max-width: 390px) {
  .mobile-edit-button {
    width: 42px;
    justify-content: center;
    padding: 0;
    font-size: 0;
  }

  .mobile-action-bar {
    gap: 8px;
    padding-right: 8px;
    padding-left: 8px;
  }

  .mobile-action-bar .button {
    padding: 0 12px;
  }
}

.studio-page--creating {
  margin-top: 12px;
}

.studio-page--creating .studio-hero {
  width: min(1060px, 100%);
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  margin: 2px auto 10px;
}

.studio-page--creating .studio-hero h1 {
  font-size: clamp(28px, 3.4vw, 40px);
}

.studio-page--creating .studio-hero p {
  display: none;
}

.studio-page--creating .studio-toolbar {
  display: none;
}

.studio-page--creating .studio-hero__status {
  align-self: center;
}

.studio-layout.is-creating {
  gap: 12px;
}

.prompt-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
}

.prompt-action-row .advanced-toggle {
  margin-top: 0;
}

.prompt-action-right {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.available-credit {
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  white-space: nowrap;
}

.prompt-generate {
  min-height: 42px;
  padding: 0 14px;
  font-size: 11px;
  box-shadow: 0 6px 16px rgb(200 102 125 / 16%);
}

.prompt-generate strong {
  padding-left: 9px;
  border-left: 1px solid rgb(255 255 255 / 34%);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  white-space: nowrap;
}

.prompt-generate:disabled {
  cursor: not-allowed;
  box-shadow: none;
}

.prompt-error {
  margin-top: 12px;
}

.prompt-footnote {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.6;
}

.compact-editor {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.compact-fields {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  overflow-x: auto;
  scrollbar-width: none;
}

.compact-fields::-webkit-scrollbar {
  display: none;
}

.compact-prompt {
  position: relative;
  display: block;
  min-width: 180px;
  flex: 1 1 260px;
}

.compact-prompt input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  transition:
    border-color 160ms var(--ease-out),
    box-shadow 160ms var(--ease-out),
    background-color 160ms var(--ease-out);
}

.compact-prompt input:focus {
  border-color: var(--action);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.compact-prompt input::placeholder {
  color: var(--muted-soft);
}

.compact-select-wrap {
  position: relative;
  display: block;
  width: 116px;
  flex: 0 0 116px;
}

.compact-select-wrap select {
  width: 100%;
  height: 42px;
  appearance: none;
  padding: 0 28px 0 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: 0;
  background: var(--surface-muted);
  color: var(--ink);
  font: inherit;
  font-size: 10px;
}

.compact-select-wrap select:focus {
  border-color: var(--action);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.compact-select-wrap svg {
  position: absolute;
  top: 50%;
  right: 8px;
  color: var(--muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.compact-resolution {
  display: flex;
  height: 42px;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-muted);
}

.compact-resolution button {
  min-width: 38px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 9px;
  font-weight: 600;
  transition:
    border-color 150ms var(--ease-out),
    background-color 150ms var(--ease-out),
    color 150ms var(--ease-out);
}

.compact-resolution button.is-selected {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-soft);
}

.compact-count {
  display: inline-grid;
  height: 42px;
  flex: 0 0 auto;
  grid-template-columns: 28px auto 28px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-muted);
}

.compact-count button {
  display: grid;
  width: 28px;
  height: 40px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.compact-count button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--ink);
}

.compact-count span {
  min-width: 42px;
  color: var(--ink);
  font-size: 9px;
  text-align: center;
  white-space: nowrap;
}

.compact-cost {
  flex: 0 0 auto;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  white-space: nowrap;
}

.compact-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
}

.compact-generate {
  min-height: 42px;
  padding: 0 13px;
  font-size: 11px;
}

.compact-generate strong {
  padding-left: 7px;
  border-left: 1px solid rgb(255 255 255 / 34%);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  font-weight: 500;
  white-space: nowrap;
}

.compact-reset {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--ink);
  cursor: pointer;
  font-size: 10px;
  transition:
    border-color 150ms var(--ease-out),
    background-color 150ms var(--ease-out),
    transform 90ms ease-out;
}

.compact-reset:hover:not(:disabled) {
  border-color: var(--line-strong);
  background: var(--surface-hover);
}

.compact-reset:active:not(:disabled) {
  transform: scale(0.96);
}

.canvas-frame {
  height: clamp(340px, 54svh, 580px);
  min-height: 0;
  flex: 0 0 auto;
}

.canvas-media {
  width: min(100%, calc(clamp(260px, 44svh, 540px) * var(--canvas-aspect)));
}

@media (max-width: 900px) {
  .studio-page {
    padding-bottom: 28px;
  }

  .studio-page--creating {
    margin-top: 8px;
  }

  .studio-page--creating .studio-hero {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }

  .studio-page--creating .studio-hero h1 {
    font-size: 29px;
  }

  .canvas-frame {
    height: clamp(280px, 44svh, 390px);
  }

  .canvas-media {
    width: min(100%, calc(clamp(210px, 32svh, 330px) * var(--canvas-aspect)));
  }

  .compact-editor {
    gap: 6px;
    padding: 7px;
    border-radius: 16px;
  }

  .compact-prompt {
    min-width: 150px;
    flex-basis: 180px;
  }

  .compact-select-wrap {
    width: 98px;
    flex-basis: 98px;
  }

  .compact-cost {
    display: none;
  }

  .compact-generate {
    min-width: 90px;
    padding: 0 10px;
  }

  .compact-reset {
    width: 40px;
    padding: 0;
  }

  .compact-reset span {
    display: none;
  }
}

@media (max-width: 620px) {
  .prompt-action-row {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .prompt-action-right {
    justify-content: space-between;
  }

  .prompt-generate {
    flex: 1;
    justify-content: center;
  }

  .studio-page--creating .studio-hero {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .studio-page--creating .studio-hero__status {
    justify-self: start;
  }

  .compact-count {
    grid-template-columns: 26px 38px 26px;
  }

  .compact-count button {
    width: 26px;
  }

  .compact-count span {
    min-width: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-hero,
  .studio-toolbar,
  .canvas-media,
  .advanced-toggle svg:last-child {
    transition: none;
  }

  .workspace,
  .studio-hero__status i.is-active,
  .canvas-live i.is-processing {
    animation: none;
  }
}
</style>
