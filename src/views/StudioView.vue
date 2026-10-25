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
  ImagePlus,
  Images,
  Info,
  LoaderCircle,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import canvasFluid from '../assets/canvas-fluid.jpg'
import ProtectedImage from '../components/ProtectedImage.vue'
import {
  APIError,
  apiBlob,
  apiRequest,
  type CreateGenerationResponse,
  type Generation,
  type GenerationList,
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
const mobileControlsOpen = ref(false)
let terminalGenerationID = ''

const recentQuery = useQuery({
  queryKey: ['generations', 'recent'],
  queryFn: () => apiRequest<GenerationList>('/api/generations?limit=6'),
})

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
const recentItems = computed(() => recentQuery.data.value?.items ?? [])
const recentAssets = computed(() =>
  recentItems.value.flatMap((generation) =>
    generation.outputs.flatMap((output) =>
      output.asset
        ? [{ generationId: generation.id, output, asset: output.asset }]
        : [],
    ),
  ).slice(0, 6),
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
  shape: string
}> = [
  { value: '1:1', label: '方形', ratio: '1 : 1', shape: 'square' },
  { value: '3:2', label: '横向', ratio: '3 : 2', shape: 'landscape' },
  { value: '2:3', label: '纵向', ratio: '2 : 3', shape: 'portrait' },
  { value: '16:9', label: '宽屏', ratio: '16 : 9', shape: 'wide' },
  { value: '9:16', label: '竖屏', ratio: '9 : 16', shape: 'tall' },
  { value: '4:3', label: '经典', ratio: '4 : 3', shape: 'classic' },
  { value: '3:4', label: '竖版', ratio: '3 : 4', shape: 'classic-portrait' },
  { value: '21:9', label: '超宽', ratio: '21 : 9', shape: 'ultra-wide' },
  { value: '9:21', label: '超长', ratio: '9 : 21', shape: 'ultra-tall' },
  { value: 'original', label: '原始', ratio: '随原图', shape: 'original' },
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
const resolutionIndex = computed({
  get: () => resolutionOptions.findIndex((option) => option.value === selectedResolution.value),
  set: (index: number) => {
    selectedResolution.value = resolutionOptions[index]?.value ?? '1K'
  },
})
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
const canvasLabel = computed(() => {
  if (selectedAspectRatio.value === 'original' && originalReference.value) {
    return `原始 ${formatAspectRatio(originalReference.value.width, originalReference.value.height)}`
  }
  return (
    aspectRatioOptions.find((item) => item.value === selectedAspectRatio.value)?.ratio ?? '1 : 1'
  )
})
const statusLabel = computed(() => {
  if (submitting.value) return '正在提交'
  switch (activeStatus.value) {
    case 'preparing':
      return '正在准备'
    case 'queued':
      return '排队中'
    case 'running':
      return '正在生成'
    case 'succeeded':
      return '生成完成'
    case 'partially_succeeded':
      return '部分成功'
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
      return '正在校验并保存参考图'
    case 'queued':
      return '任务已进入队列，等待可用生成通道'
    case 'running':
      return `${activeGeneration.value?.outputs.filter((output) => output.status === 'succeeded').length ?? 0} / ${activeGeneration.value?.outputs.length ?? count.value} 张已完成`
    case 'partially_succeeded':
      return '部分图片已成功生成，失败的输出未扣除积分'
    case 'failed':
      return activeGeneration.value?.errorMessage || '本次任务没有成功输出，冻结积分已释放'
    case 'succeeded':
      return `本次正式扣除 ${activeGeneration.value?.chargedCredits ?? 0} 积分`
    default:
      return '生成结果会以显影动效落定在画布中央'
  }
})

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

function selectAspectRatio(value: AspectRatioValue) {
  if (value === 'original' && !originalRatioAvailable.value) {
    return
  }
  selectedAspectRatio.value = value
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

function greatestCommonDivisor(left: number, right: number): number {
  let first = Math.abs(left)
  let second = Math.abs(right)
  while (second !== 0) {
    const remainder = first % second
    first = second
    second = remainder
  }
  return first || 1
}

function formatAspectRatio(width: number, height: number) {
  const divisor = greatestCommonDivisor(width, height)
  const ratioWidth = width / divisor
  const ratioHeight = height / divisor
  if (ratioWidth <= 100 && ratioHeight <= 100) {
    return `${ratioWidth} : ${ratioHeight}`
  }
  return `${(width / height).toFixed(2)} : 1`
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
    selectedAssetId.value = ''
    terminalGenerationID = ''
    auth.updateCredits(
      Math.max(0, (auth.user?.availableCredits ?? 0) - created.estimatedCredits),
      (auth.user?.reservedCredits ?? 0) + created.estimatedCredits,
    )
    mobileControlsOpen.value = false
    notifications.push('任务已提交，积分已按张数冻结。', 'success')
    await queryClient.invalidateQueries({ queryKey: ['generations', 'recent'] })
  } catch (error) {
    submitError.value = error instanceof APIError ? error.message : '任务提交失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
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
      notifications.push(
        generation.status === 'succeeded' ? '图片已完成。' : '部分图片已完成，失败输出未扣费。',
        generation.status === 'succeeded' ? 'success' : 'warning',
      )
    } else if (generation.status === 'failed') {
      notifications.push(generation.errorMessage || '图片生成失败，冻结积分已释放。', 'error')
    }
  }
})

watch(mobileControlsOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

watch(
  () => route.query.reuse,
  () => void applyReuse(),
  { immediate: true },
)

onBeforeUnmount(() => {
  clearReferences()
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="studio-page">
    <div class="studio-toolbar">
      <div class="mode-switch" role="tablist" aria-label="生成模式">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'generate'"
          :class="{ 'is-active': mode === 'generate' }"
          @click="setMode('generate')"
        >
          <WandSparkles :size="16" aria-hidden="true" />
          文生图
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'edit'"
          :class="{ 'is-active': mode === 'edit' }"
          @click="setMode('edit')"
        >
          <Images :size="16" aria-hidden="true" />
          图生图
        </button>
      </div>
      <div class="workspace-status">
        <span class="status-dot" :class="{ 'status-dot--ready': publicSettings?.generationReady }" />
        <span v-if="settingsLoading">正在检查生成服务</span>
        <span v-else-if="publicSettings?.generationReady">生成服务已连接 · {{ statusLabel }}</span>
        <span v-else>基础账户功能可用 · 请管理员配置生成服务</span>
      </div>
      <div class="toolbar-meta">
        <span>保留 {{ publicSettings?.retentionDays ?? 7 }} 天</span>
        <span>PNG</span>
      </div>
    </div>

    <div class="studio-layout">
      <div
        v-if="mobileControlsOpen"
        class="controls-backdrop"
        aria-hidden="true"
        @click="mobileControlsOpen = false"
      />

      <aside class="control-rail" :class="{ 'is-open': mobileControlsOpen }">
        <div class="mobile-rail-head">
          <div>
            <strong>创作参数</strong>
            <span>{{ mode === 'generate' ? '文生图' : '图生图' }}</span>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="关闭参数"
            @click="mobileControlsOpen = false"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>

        <section class="tool-card prompt-card">
          <div class="card-heading">
            <div>
              <span class="card-index">01</span>
              <h2>描述画面</h2>
            </div>
            <span class="char-count">{{ prompt.length }} / 4000</span>
          </div>
          <textarea
            v-model="prompt"
            maxlength="4000"
            rows="6"
            placeholder="描述光线、材质、构图和情绪。越具体，画面越接近你的想象。"
            aria-label="画面提示词"
          />
          <div class="prompt-suggestions" aria-label="提示词示例">
            <button
              v-for="(sample, index) in samplePrompts"
              :key="sample"
              type="button"
              @click="choosePrompt(sample)"
            >
              示例 {{ index + 1 }}
            </button>
          </div>
        </section>

        <section v-if="mode === 'edit'" class="tool-card reference-card">
          <div class="card-heading">
            <div>
              <span class="card-index">02</span>
              <h2>参考图</h2>
            </div>
            <span class="char-count">{{ references.length }} / 4</span>
          </div>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            @change="handleFiles"
          />
          <div class="reference-grid">
            <div v-for="reference in references" :key="reference.id" class="reference-item">
              <img :src="reference.url" :alt="reference.file.name" />
              <button
                type="button"
                :aria-label="`移除 ${reference.file.name}`"
                :title="`移除 ${reference.file.name}`"
                @click="removeReference(reference.id)"
              >
                <X :size="14" aria-hidden="true" />
              </button>
            </div>
            <button
              v-if="references.length < 4"
              type="button"
              class="reference-add"
              @click="openFilePicker"
            >
              <Upload :size="18" aria-hidden="true" />
              <span>添加图片</span>
            </button>
          </div>
          <p class="card-note">PNG、JPEG、WebP，单张不超过 10 MB</p>
          <p v-if="uploadError" class="field-error" role="alert">{{ uploadError }}</p>
        </section>

        <section class="tool-card parameters-card">
          <div class="card-heading">
            <div>
              <span class="card-index">{{ mode === 'edit' ? '03' : '02' }}</span>
              <h2>画面参数</h2>
            </div>
            <SlidersHorizontal :size="17" aria-hidden="true" />
          </div>

          <div class="parameter-block">
            <span class="parameter-label">画幅比例</span>
            <div class="size-options" role="radiogroup" aria-label="画幅比例">
              <button
                v-for="ratio in aspectRatioOptions"
                :key="ratio.value"
                type="button"
                role="radio"
                :aria-checked="selectedAspectRatio === ratio.value"
                :aria-disabled="ratio.value === 'original' && !originalRatioAvailable"
                :disabled="ratio.value === 'original' && !originalRatioAvailable"
                :class="{ 'is-selected': selectedAspectRatio === ratio.value }"
                :title="
                  ratio.value === 'original' && !originalRatioAvailable
                    ? '原始比例需要图生图参考图'
                    : undefined
                "
                @click="selectAspectRatio(ratio.value)"
              >
                <span
                  class="size-shape"
                  :class="`size-shape--${ratio.shape}`"
                />
                <span>
                  <strong>{{ ratio.label }}</strong>
                  <small>{{ ratio.ratio }}</small>
                </span>
              </button>
            </div>
          </div>

          <div class="parameter-block resolution-block">
            <div class="resolution-heading">
              <span class="parameter-label">分辨率</span>
              <strong>{{ selectedResolution }} · {{ requestedSize }}</strong>
            </div>
            <div class="resolution-slider">
              <input
                v-model.number="resolutionIndex"
                type="range"
                min="0"
                :max="resolutionOptions.length - 1"
                step="1"
                aria-label="分辨率档位"
              />
              <div class="resolution-marks">
                <button
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-active': selectedResolution === option.value }"
                  @click="selectedResolution = option.value"
                >
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.description }}</small>
                  <span>{{ publicSettings?.pricing[option.value] ?? '—' }} 积分</span>
                </button>
              </div>
            </div>
          </div>

          <label class="parameter-block">
            <span class="parameter-label">质量</span>
            <span class="select-wrap">
              <select v-model="quality">
                <option v-for="option in qualityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <ChevronDown :size="16" aria-hidden="true" />
            </span>
          </label>

          <label class="parameter-block">
            <span class="parameter-label">背景</span>
            <span class="select-wrap">
              <select v-model="background">
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

          <div class="parameter-block count-block">
            <span class="parameter-label">生成张数</span>
            <div class="stepper" aria-label="生成张数">
              <button
                type="button"
                aria-label="减少生成张数"
                :disabled="count <= 1"
                @click="decrementCount"
              >
                <Minus :size="15" aria-hidden="true" />
              </button>
              <strong>{{ count }}</strong>
              <button
                type="button"
                aria-label="增加生成张数"
                :disabled="count >= 4"
                @click="incrementCount"
              >
                <Plus :size="15" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <div class="estimate-row">
          <div>
            <span>本次预计</span>
            <strong>{{ totalCost }} <small>积分</small></strong>
          </div>
          <span>{{ count }} 张 × {{ unitCost }}</span>
        </div>

        <div v-if="submitError" class="inline-alert inline-alert--error" role="alert">
          {{ submitError }}
        </div>
        <button
          class="button button--primary button--wide generate-button"
          type="button"
          :disabled="!canSubmit"
          @click="submitGeneration"
        >
          <LoaderCircle v-if="submitting || taskIsActive" class="spin" :size="18" aria-hidden="true" />
          <Aperture v-else :size="18" aria-hidden="true" />
          <span v-if="submitting">正在提交</span>
          <span v-else-if="taskIsActive">{{ statusLabel }}</span>
          <span v-else-if="publicSettings?.generationReady">开始生成</span>
          <span v-else>生成服务未连接</span>
        </button>
        <p class="rail-footnote">
          按成功输出逐张结算。失败或超时的图片会释放对应冻结积分。
        </p>
      </aside>

      <section class="workspace">
        <article class="canvas-card">
          <header class="canvas-head">
            <div>
              <span class="canvas-live">
                <i :class="{ 'is-processing': taskIsActive, 'is-error': activeStatus === 'failed' }" />
                {{ statusLabel }}
              </span>
              <span class="canvas-size">
                {{ selectedOutput?.asset ? `${selectedOutput.asset.width} × ${selectedOutput.asset.height}` : requestedSize }} · PNG
              </span>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="全屏预览画布"
              title="全屏预览"
              @click="openPreview"
            >
              <Expand :size="18" aria-hidden="true" />
            </button>
          </header>

          <button
            type="button"
            class="canvas-frame"
            :style="{ '--canvas-ratio': canvasRatio }"
            :aria-label="selectedOutput?.asset ? '打开生成结果预览' : '打开画布预览'"
            @click="openPreview"
          >
            <ProtectedImage
              v-if="selectedOutput?.asset"
              :key="selectedOutput.asset.id"
              :asset-id="selectedOutput.asset.id"
              :alt="activeGeneration?.prompt || '生成结果'"
              class="canvas-result-image"
            />
            <div v-else-if="taskIsActive" class="canvas-task-state">
              <span class="canvas-task-mark">
                <LoaderCircle class="spin" :size="26" aria-hidden="true" />
              </span>
              <strong>{{ statusLabel }}</strong>
              <span>{{ statusHint }}</span>
              <div class="task-progress">
                <i
                  v-for="(output, index) in activeGeneration?.outputs"
                  :key="output.id"
                  :class="{ 'is-done': output.status === 'succeeded', 'is-error': output.status === 'failed' }"
                >
                  {{ index + 1 }}
                </i>
              </div>
            </div>
            <div
              v-else-if="activeGeneration && ['failed', 'partially_succeeded'].includes(activeGeneration.status) && !selectedOutput?.asset"
              class="canvas-task-state canvas-task-state--error"
            >
              <span class="canvas-task-mark">
                <CircleAlert :size="26" aria-hidden="true" />
              </span>
              <strong>{{ statusLabel }}</strong>
              <span>{{ statusHint }}</span>
            </div>
            <img v-else :src="canvasFluid" alt="蓝橙两色油墨在水中扩散的抽象画面" />
            <span class="canvas-preview-badge">
              {{ selectedOutput?.asset ? '生成结果' : taskIsActive ? '显影中' : '视觉预览' }}
            </span>
            <span class="canvas-frame__meta">
              <span>{{ selectedOutput?.asset ? `${selectedOutput.asset.width} × ${selectedOutput.asset.height}` : canvasLabel }}</span>
              <span>gpt-image-2</span>
            </span>
          </button>

          <div v-if="activeGeneration?.outputs.length" class="output-strip">
            <button
              v-for="output in activeGeneration.outputs"
              :key="output.id"
              type="button"
              :class="{ 'is-selected': selectedAssetId === output.asset?.id }"
              :disabled="!output.asset"
              @click="selectOutput(output)"
            >
              <ProtectedImage
                v-if="output.asset"
                :asset-id="output.asset.id"
                :alt="`第 ${output.position} 张生成结果`"
                thumbnail
              />
              <span v-else class="output-strip__state">
                <LoaderCircle v-if="['queued', 'running'].includes(output.status)" class="spin" :size="15" aria-hidden="true" />
                <CircleAlert v-else :size="15" aria-hidden="true" />
              </span>
              <small>{{ String(output.position).padStart(2, '0') }}</small>
            </button>
          </div>

          <footer class="canvas-foot">
            <div>
              <CheckCircle2 v-if="activeStatus === 'succeeded'" :size="16" aria-hidden="true" />
              <CircleAlert v-else-if="activeStatus === 'failed'" :size="16" aria-hidden="true" />
              <Sparkles v-else :size="16" aria-hidden="true" />
              <span>{{ statusHint }}</span>
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
                <Heart
                  :size="16"
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
                <Download v-else :size="16" aria-hidden="true" />
              </button>
            </div>
            <span v-else-if="!activeGeneration">预览图仅作界面验收</span>
          </footer>
        </article>

        <section class="contact-sheet">
          <header class="contact-head">
            <div>
              <span class="card-index">RECENT</span>
              <h2>最近结果</h2>
            </div>
            <RouterLink to="/history">查看全部</RouterLink>
          </header>

          <div v-if="recentAssets.length" class="recent-grid">
            <button
              v-for="item in recentAssets"
              :key="item.asset.id"
              type="button"
              class="recent-card"
              @click="router.push(`/history/${item.generationId}`)"
            >
              <span class="recent-card__image">
                <ProtectedImage
                  :asset-id="item.asset.id"
                  :alt="item.output.errorMessage || '最近生成作品'"
                  thumbnail
                />
              </span>
              <span class="recent-card__meta">
                <span>{{ item.asset.width }} × {{ item.asset.height }}</span>
                <span>{{ item.output.creditsCharged }} 积分</span>
                <Heart
                  v-if="item.asset.isFavorite"
                  :size="12"
                  fill="currentColor"
                  aria-label="已收藏"
                />
              </span>
            </button>
          </div>
          <div v-else class="contact-empty">
            <div class="contact-empty__mark">
              <ImagePlus :size="24" :stroke-width="1.5" aria-hidden="true" />
            </div>
            <div>
              <strong>接触印样等待第一张作品</strong>
              <p>完成的图片会按时间显示在这里，并保留 {{ publicSettings?.retentionDays ?? 7 }} 天。</p>
            </div>
            <div class="contact-slots" aria-hidden="true">
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
            </div>
          </div>
        </section>
      </section>
    </div>

    <div class="mobile-action-bar">
      <button
        type="button"
        class="mobile-edit-button"
        @click="mobileControlsOpen = true"
      >
        <SlidersHorizontal :size="18" aria-hidden="true" />
        参数
      </button>
      <div class="mobile-estimate">
        <span>{{ count }} 张</span>
        <strong>{{ totalCost }} 积分</strong>
      </div>
      <button
        type="button"
        class="button button--primary"
        :disabled="!canSubmit"
        @click="submitGeneration"
      >
        <LoaderCircle v-if="submitting || taskIsActive" class="spin" :size="16" aria-hidden="true" />
        <span v-if="submitting">提交中</span>
        <span v-else-if="taskIsActive">{{ statusLabel }}</span>
        <span v-else-if="publicSettings?.generationReady">开始生成</span>
        <span v-else>生成未连接</span>
      </button>
    </div>

    <dialog ref="previewDialog" class="image-dialog" @click="closeDialogFromBackdrop">
      <div class="image-dialog__bar">
        <div>
          <strong>{{ selectedOutput?.asset ? '生成结果' : '画布预览' }}</strong>
          <span>{{ selectedOutput?.asset ? `${selectedOutput.asset.width} × ${selectedOutput.asset.height}` : requestedSize }} · PNG</span>
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
      <img v-else :src="canvasFluid" alt="蓝橙两色油墨在水中扩散的抽象画面" />
      <div class="image-dialog__note">
        <Info :size="16" aria-hidden="true" />
        <span v-if="selectedOutput?.asset">
          {{ statusHint }} · 保留至 {{ new Date(selectedOutput.asset.expiresAt).toLocaleString('zh-CN') }}
        </span>
        <span v-else>当前为界面视觉预览，尚未产生生成任务与积分消耗。</span>
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
  border-radius: 9px;
  background: var(--surface-muted);
}

.mode-switch button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
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
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 7px 22px color-mix(in srgb, var(--shadow-color) 55%, transparent);
}

.prompt-card,
.reference-card,
.parameters-card {
  padding: 14px;
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
  border-radius: 8px;
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
  border-radius: 7px;
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
  border-radius: 8px;
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
  border-radius: 6px;
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
  border-radius: 8px;
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
  border-radius: 8px;
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
  border-radius: 8px;
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
  border-radius: 9px;
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
  border-radius: 7px;
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
  border-radius: 8px;
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
  border-radius: 10px;
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
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--shadow-color) 50%, transparent);
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
  border-radius: 10px;
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
  border-radius: 10px;
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
  border-radius: 5px;
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
  border-radius: 7px;
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
  border-radius: 7px;
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
  border-radius: 14px;
  background: var(--surface);
}

.contact-head {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
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
  border-radius: 8px;
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
  border-radius: 10px;
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
  border-radius: 6px;
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
  border-radius: 14px;
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
    z-index: 60;
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
    border-radius: 8px;
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
</style>
