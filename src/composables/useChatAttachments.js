import { ref } from 'vue'
import { agnoClient } from '../services/api/agno-runtime.client.js'

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx']
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

function kindFromName(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'IMAGE'
  if (ext === 'pdf') return 'PDF'
  if (ext === 'docx') return 'DOCX'
  if (ext === 'xlsx') return 'XLSX'
  return 'FILE'
}

function iconForKind(kind) {
  return {
    IMAGE: 'image',
    PDF: 'picture_as_pdf',
    DOCX: 'article',
    XLSX: 'table_chart'
  }[kind] || 'insert_drive_file'
}

/**
 * Composable quản lý danh sách file đính kèm cho 1 lượt chat.
 * Mỗi entry: { tempId, file, name, sizeBytes, kind, status: 'uploading'|'ready'|'error', attachmentId, errorMessage }
 */
export function useChatAttachments({ getSessionId, getUserId } = {}) {
  const items = ref([])

  function validate(file) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return `Định dạng .${ext} không được hỗ trợ (chỉ: ${ALLOWED_EXT.join(', ')})`
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File vượt quá ${MAX_SIZE_BYTES / 1024 / 1024}MB`
    }
    return null
  }

  async function uploadOne(entry) {
    try {
      const fd = new FormData()
      fd.append('file', entry.file)
      const sid = getSessionId?.()
      const uid = getUserId?.()
      if (sid && sid !== 'pending') fd.append('session_id', sid)
      if (uid) fd.append('user_id', uid)

      const res = await agnoClient.uploadAttachment(fd)
      const idx = items.value.findIndex(i => i.tempId === entry.tempId)
      if (idx === -1) return // đã bị xoá trong lúc đang upload
      if (res.status === 'FAILED') {
        items.value[idx] = { ...items.value[idx], status: 'error', errorMessage: res.error_message || 'Xử lý file thất bại' }
      } else {
        items.value[idx] = { ...items.value[idx], status: 'ready', attachmentId: res.id }
      }
    } catch (e) {
      const idx = items.value.findIndex(i => i.tempId === entry.tempId)
      if (idx === -1) return
      items.value[idx] = {
        ...items.value[idx],
        status: 'error',
        errorMessage: e.response?.data?.detail || e.response?.data?.message || 'Upload thất bại — kiểm tra kết nối'
      }
    }
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || [])
    for (const file of files) {
      const err = validate(file)
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const entry = {
        tempId,
        file,
        name: file.name,
        sizeBytes: file.size,
        kind: kindFromName(file.name),
        icon: iconForKind(kindFromName(file.name)),
        status: err ? 'error' : 'uploading',
        attachmentId: null,
        errorMessage: err
      }
      items.value.push(entry)
      if (!err) uploadOne(entry)
    }
  }

  function retry(tempId) {
    const idx = items.value.findIndex(i => i.tempId === tempId)
    if (idx === -1) return
    items.value[idx] = { ...items.value[idx], status: 'uploading', errorMessage: null }
    uploadOne(items.value[idx])
  }

  function remove(tempId) {
    items.value = items.value.filter(i => i.tempId !== tempId)
  }

  function reset() {
    items.value = []
  }

  function hasUploading() {
    return items.value.some(i => i.status === 'uploading')
  }

  function readyIds() {
    return items.value.filter(i => i.status === 'ready').map(i => i.attachmentId)
  }

  function readySnapshot() {
    // dùng để gắn vào message bubble hiển thị lịch sử
    return items.value
      .filter(i => i.status === 'ready')
      .map(i => ({ id: i.attachmentId, name: i.name, kind: i.kind, icon: i.icon }))
  }

  return { items, addFiles, retry, remove, reset, hasUploading, readyIds, readySnapshot }
}