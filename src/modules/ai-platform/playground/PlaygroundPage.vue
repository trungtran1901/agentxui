<template>
  <q-page class="play-layout">
    <!-- Toolbar -->
    <div class="play-toolbar">
      <div style="display:flex;align-items:center;gap:8px">
        <q-icon name="play_circle_outline" size="20px" style="color:var(--brand-primary)" />
        <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Playground</span>
        <span class="badge badge--running badge--no-dot">BETA</span>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex:1;justify-content:center">
        <div class="play-select-group">
          <q-select v-model="agentOsCode" :options="agentOsOptions" outlined dense clearable emit-value map-options
            label="AgentOS *" style="width:180px" @update:model-value="teamCode=null;agentCode=null;loadTeams()" />
          <q-select v-model="teamCode" :options="teamOptions" outlined dense clearable emit-value map-options
            label="Team" style="width:155px" :disable="!agentOsCode" @update:model-value="agentCode=null;loadAgents()" />
          <q-select v-model="agentCode" :options="agentOptions" outlined dense clearable emit-value map-options
            label="Agent" style="width:175px" :disable="!agentOsCode" />
        </div>
        <div class="play-toolbar__divider" />
        <div class="play-mode-toggle">
          <button :class="['play-mode-btn', !useStream && 'play-mode-btn--active']" @click="useStream=false">Sync</button>
          <button :class="['play-mode-btn', useStream && 'play-mode-btn--active']" @click="useStream=true">Stream</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <span v-if="sessionId && sessionId!=='pending'" class="code-tag" style="font-size:10px">
          sid: {{ sessionId.substring(0,10) }}…
        </span>
        <button class="btn btn--primary btn--sm" :disabled="!agentOsCode" @click="startSession">
          <q-icon name="add" size="14px" />
          New Session
        </button>
      </div>
    </div>

    <div class="play-body">
      <!-- Chat panel -->
      <div class="play-chat">
        <!-- Messages -->
        <div ref="msgRef" class="play-messages">
          <!-- Empty state -->
          <div v-if="!messages.length" class="play-empty">
            <div class="play-empty__icon">
              <q-icon name="forum" size="28px" style="color:var(--text-quaternary)" />
            </div>
            <div class="play-empty__title">Start a conversation</div>
            <div class="play-empty__desc">
              Select an AgentOS + Team (Agent optional), click "New Session", then send a message.<br>
              Supports <strong>POST /chat</strong> (sync) and <strong>POST /chat/stream</strong> (SSE).
            </div>
            <div v-if="userId" class="play-empty__user">
              <q-icon name="person" size="13px" />
              user_id: {{ userId }}
            </div>
          </div>

          <!-- Messages -->
          <template v-for="msg in messages" :key="msg.id">

            <!-- Tool call / status block (inline, between messages) -->
            <div v-if="msg.role==='tool_event'" class="play-tool-event anim-fade" :class="`play-tool-event--${msg.ui_status}`">
              <div class="play-tool-event__icon">
                <q-icon :name="toolEventIcon(msg.ui_status)" size="13px" />
              </div>
              <div class="play-tool-event__body">
                <span class="play-tool-event__label">{{ msg.label }}</span>
                <span v-if="msg.agno_event" class="play-tool-event__tag">{{ msg.agno_event }}</span>
              </div>
              <div v-if="msg.ui_status==='tool_call'" class="play-tool-event__dots">
                <span/><span/><span/>
              </div>
            </div>

            <!-- Regular chat bubble -->
            <div v-else class="play-msg" :class="`play-msg--${msg.role}`">
              <div class="play-msg__avatar" :class="`play-msg__avatar--${msg.role}`">
                <q-icon :name="msg.role==='user'?'person':'smart_toy'" size="14px" />
              </div>
              <div class="play-msg__content">
                <div class="play-msg__bubble"
                  :class="[`play-msg__bubble--${msg.role}`, msg.cancelled && 'play-msg__bubble--cancelled']">
                  <span style="white-space:pre-wrap">{{ msg.content }}</span>
                  <span v-if="msg.cancelled"
                    style="display:inline-block;margin-left:6px;font-size:10px;font-weight:600;color:var(--brand-danger);vertical-align:middle">
                    stopped
                  </span>
                </div>
                <div class="play-msg__meta">
                  {{ msg.role }} · {{ dayjs(msg.created_at).format('HH:mm:ss') }}
                </div>
              </div>
            </div>

          </template>

          <!-- Thinking (waiting for first event) -->
          <div v-if="thinking" class="play-msg play-msg--assistant anim-fade">
            <div class="play-msg__avatar play-msg__avatar--assistant">
              <q-icon name="smart_toy" size="14px" />
            </div>
            <div class="play-msg__content">
              <div class="play-msg__bubble play-msg__bubble--assistant play-thinking">
                <span /><span /><span />
              </div>
            </div>
          </div>

          <!-- Streaming text -->
          <div v-if="streamBuf" class="play-msg play-msg--assistant anim-fade">
            <div class="play-msg__avatar play-msg__avatar--assistant">
              <q-icon name="smart_toy" size="14px" />
            </div>
            <div class="play-msg__content">
              <div class="play-msg__bubble play-msg__bubble--assistant">
                <span style="white-space:pre-wrap">{{ streamBuf }}</span>
                <span class="play-cursor">|</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="play-input-area">
          <div class="play-input-box">
            <textarea
              v-model="userInput"
              class="play-textarea"
              :placeholder="sessionId ? 'Type a message… (Enter to send, Shift+Enter for newline)' : 'Start a session first…'"
              :disabled="!sessionId || thinking"
              rows="1"
              @keydown.enter.exact.prevent="send"
              @input="autoResize"
              ref="textareaRef"
            />

            <!-- Stop button — only in stream mode while streaming -->
            <button v-if="useStream && isStreaming"
              class="play-stop-btn"
              :class="{ 'play-stop-btn--cancelling': isCancelling }"
              :disabled="isCancelling"
              @click="cancelStream"
              title="Stop generation (POST /runs/{id}/cancel)">
              <q-spinner v-if="isCancelling" size="14px" style="color:var(--brand-danger)" />
              <template v-else>
                <span class="play-stop-btn__square" />
              </template>
            </button>

            <!-- Send button — hidden while streaming -->
            <button v-else
              class="play-send-btn"
              :disabled="!userInput.trim()||!sessionId||thinking"
              @click="send">
              <q-icon name="arrow_upward" size="18px" />
            </button>
          </div>
          <div class="play-input-meta">
            <span>{{ useStream ? 'POST /chat/stream (SSE events)' : 'POST /chat (synchronous)' }}</span>
            <span v-if="lastRunId">
              · run: {{ lastRunId.substring(0,12) }}…
              <template v-if="useStream && isStreaming">
                · <span style="color:var(--brand-secondary);font-weight:600">streaming</span>
              </template>
            </span>
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="play-panel">
        <div class="play-panel__tabs">
          <button v-for="t in panelTabs" :key="t.key"
            :class="['play-panel__tab', rightTab===t.key && 'play-panel__tab--active']"
            @click="rightTab=t.key">
            <q-icon :name="t.icon" size="14px" />
            {{ t.label }}
          </button>
        </div>

        <div class="play-panel__body">
          <!-- Events -->
          <div v-show="rightTab==='events'">
            <div v-if="!streamEvents.length" class="empty-state" style="padding:40px 16px">
              <div class="empty-state__icon"><q-icon name="event_note" /></div>
              <div class="empty-state__title">No events</div>
              <div class="empty-state__desc">AG-UI events from Agno appear here during streaming</div>
            </div>
            <div class="play-event-timeline">
              <div v-for="ev in streamEvents" :key="ev.id" class="play-ev anim-fade" :class="`play-ev--${ev.ui_status||'default'}`">
                <div class="play-ev__dot" />
                <div class="play-ev__body">
                  <div class="play-ev__head">
                    <span class="play-ev__agno">{{ ev.agno_event || ev.type }}</span>
                    <span class="play-ev__time">{{ dayjs(ev.ts).format('HH:mm:ss.SSS') }}</span>
                  </div>
                  <div v-if="ev.message" class="play-ev__msg">{{ ev.message }}</div>
                  <div v-if="ev.detail" class="play-ev__detail" v-text="ev.detail" />
                </div>
              </div>
            </div>
          </div>

          <!-- Runs -->
          <div v-show="rightTab==='runs'">
            <div v-if="!sessionRuns.length" class="empty-state" style="padding:40px 16px">
              <div class="empty-state__icon"><q-icon name="history" /></div>
              <div class="empty-state__title">No runs yet</div>
            </div>
            <div v-for="r in sessionRuns" :key="r.id" class="play-run" @click="loadRunEvents(r.id)">
              <span class="badge" :class="r.status==='completed'?'badge--active':'badge--pending'">{{ r.status }}</span>
              <span class="font-mono" style="font-size:10px;color:var(--text-tertiary);flex:1">{{ r.id.substring(0,16) }}…</span>
              <span style="font-size:10px;color:var(--text-quaternary)">{{ dayjs(r.created_at).format('HH:mm') }}</span>
            </div>
          </div>

          <!-- Memory -->
          <div v-show="rightTab==='memory'">
            <div style="padding:8px">
              <button class="btn btn--secondary btn--sm" style="width:100%;margin-bottom:8px" @click="loadMemory" :disabled="loadingMemory">
                <q-spinner v-if="loadingMemory" size="12px" />
                <span>{{ loadingMemory ? 'Loading…' : 'Load Memory' }}</span>
              </button>
            </div>
            <div v-if="!agentMemories.length" class="empty-state" style="padding:32px 16px">
              <div class="empty-state__icon"><q-icon name="memory" /></div>
              <div class="empty-state__title">No memories</div>
              <div class="empty-state__desc">Agentic memory via GET /agents/{id}/memories</div>
            </div>
            <div v-for="m in agentMemories" :key="m.id" class="play-memory">
              <div style="font-size:12px;line-height:1.6;color:var(--text-primary)">{{ m.content }}</div>
              <div style="font-size:10px;color:var(--text-quaternary);margin-top:4px">{{ dayjs(m.created_at).format('YYYY-MM-DD HH:mm') }}</div>
            </div>
          </div>
          <!-- cURL -->
          <div v-show="rightTab==='curl'" class="play-curl">
            <div class="play-curl__header">
              <div class="play-curl__title">
                <q-icon name="code" size="14px" style="color:var(--brand-primary)" />
                <span>cURL Request</span>
                <span class="badge badge--running badge--no-dot" style="font-size:10px">{{ useStream ? 'STREAM' : 'SYNC' }}</span>
              </div>
              <button class="play-curl__copy-btn" :class="curlCopied && 'play-curl__copy-btn--copied'" @click="copyCurl">
                <q-icon :name="curlCopied ? 'check' : 'content_copy'" size="13px" />
                {{ curlCopied ? 'Copied!' : 'Copy' }}
              </button>
            </div>

            <div v-if="!agentOsCode" class="play-curl__hint">
              <q-icon name="info" size="13px" />
              Chọn AgentOS + Team để sinh cURL đầy đủ
            </div>

            <pre class="play-curl__code" v-text="buildCurl(useStream)" />

            <div class="play-curl__section-title">Sync (POST /chat)</div>
            <pre class="play-curl__code play-curl__code--dim" v-text="buildCurl(false)" />

            <div class="play-curl__section-title">Stream (POST /chat/stream)</div>
            <pre class="play-curl__code play-curl__code--dim" v-text="buildCurl(true)" />

            <div class="play-curl__section-title">Cancel (POST /runs/{id}/cancel)</div>
            <pre class="play-curl__code play-curl__code--dim" v-text="buildCancelCurl()" />
          </div>

        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, nextTick, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { agnoClient } from '../../../services/api/agno-runtime.client.js'
import { keycloakService } from '../../../services/keycloak.service.js'
import { useUIStore } from '../../../stores/ui.store.js'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'PlaygroundPage',
  setup() {
    const $q = useQuasar()
    const uiStore = useUIStore()
    uiStore.setBreadcrumbs([{ label: 'AI Platform' }, { label: 'Playground' }])

    const agentOsCode = ref(null), agentOsOptions = ref([])
    const teamCode = ref(null), teamOptions = ref([])
    const agentCode = ref(null), agentOptions = ref([])
    // keep raw lists around so we can resolve code -> id (memories endpoint needs agent id)
    const teamsRaw = ref([]), agentsRaw = ref([])
    const sessionId = ref(null), lastRunId = ref(null)
    const userInput = ref(''), thinking = ref(false), streamBuf = ref(''), useStream = ref(true)
    const isCancelling = ref(false)
    const isStreaming = ref(false)   // true suốt quá trình stream (từ lúc gửi tới lúc completed/cancelled), dùng để hiện nút Stop
    let activeReader = null          // holds the ReadableStreamDefaultReader during streaming, used by cancelStream
    const messages = ref([]), streamEvents = ref([]), sessionRuns = ref([])
    const agentMemories = ref([]), loadingMemory = ref(false)
    const rightTab = ref('events'), msgRef = ref(null), textareaRef = ref(null)
    // userId from Keycloak sub claim
    const userId = ref(keycloakService.getUserId() || '')

    const panelTabs = [
      { key: 'events', label: 'Events', icon: 'event_note' },
      { key: 'runs', label: 'Runs', icon: 'history' },
      { key: 'memory', label: 'Memory', icon: 'memory' },
      { key: 'curl', label: 'cURL', icon: 'code' }
    ]

    const scrollBottom = () => nextTick(() => { if (msgRef.value) msgRef.value.scrollTop = msgRef.value.scrollHeight })
    const autoResize = () => { if (textareaRef.value) { textareaRef.value.style.height = 'auto'; textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 160) + 'px' } }

    async function loadOptions() {
      try {
        const r = await agnoClient.listAgentOS({ page_size: 100 })
        agentOsOptions.value = r.items.map(a => ({ label: a.name, value: a.code }))
      } catch {}
    }

    async function loadTeams() {
      teamOptions.value = []; teamsRaw.value = []
      agentOptions.value = []; agentsRaw.value = []
      if (!agentOsCode.value) return
      try {
        // resolve agentOs code -> id to filter teams
        const osList = await agnoClient.listAgentOS({ page_size: 100 })
        const os = osList.items.find(o => o.code === agentOsCode.value)
        if (!os) return
        const r = await agnoClient.listTeams({ agent_os_id: os.id, page_size: 100 })
        teamsRaw.value = r.items
        teamOptions.value = r.items.map(t => ({ label: t.name, value: t.code }))
      } catch {}
    }

    async function loadAgents() {
      agentOptions.value = []; agentsRaw.value = []
      if (!teamCode.value) return
      try {
        const team = teamsRaw.value.find(t => t.code === teamCode.value)
        if (!team) return
        const r = await agnoClient.listAgents({ team_id: team.id, page_size: 100 })
        agentsRaw.value = r.items
        agentOptions.value = r.items.map(a => ({ label: a.name, value: a.code }))
      } catch {}
    }

    function startSession() {
      sessionId.value = 'pending'
      messages.value = []; streamEvents.value = []; sessionRuns.value = []; agentMemories.value = []; lastRunId.value = null
      $q.notify({ type: 'positive', message: 'Session ready — send your first message' })
    }

    async function send() {
      const content = userInput.value.trim()
      if (!content || !sessionId.value || !agentOsCode.value) return
      userInput.value = ''
      if (textareaRef.value) textareaRef.value.style.height = 'auto'
      messages.value.push({ id: Date.now().toString(), role: 'user', content, created_at: new Date() })
      scrollBottom(); thinking.value = true

      // POST /chat body contract: agentOs, team, agent (optional), message, session_id, user_id
      const body = {
        agentOs: agentOsCode.value,
        ...(teamCode.value ? { team: teamCode.value } : {}),
        ...(agentCode.value ? { agent: agentCode.value } : {}),
        message: content,
        ...(sessionId.value !== 'pending' ? { session_id: sessionId.value } : {}),
        ...(userId.value ? { user_id: userId.value } : {})
      }

      if (useStream.value) await sendStream(body)
      else await sendSync(body)
    }

    async function sendSync(body) {
      try {
        const res = await agnoClient.chat(body)
        if (res.session_id) sessionId.value = res.session_id
        if (res.run_id) { lastRunId.value = res.run_id; sessionRuns.value.unshift({ id: res.run_id, status: res.status || 'completed', created_at: new Date() }) }
        // API response field is "message", not "response"
        messages.value.push({ id: Date.now().toString(), role: 'assistant', content: res.message, created_at: new Date() })
      } catch (e) {
        const ec = e.response?.data?.error_code || 'error'
        const em = e.response?.data?.message || e.message
        messages.value.push({ id: Date.now().toString(), role: 'assistant', content: `[${ec}] ${em}`, created_at: new Date() })
      } finally { thinking.value = false; scrollBottom() }
    }

    // Agno agno_event → icon mapping
    function toolEventIcon(uiStatus) {
      const map = {
        tool_call: 'build',
        thinking: 'psychology',
        retrieving: 'search',
        completed: 'check_circle',
        error: 'error_outline'
      }
      return map[uiStatus] || 'radio_button_checked'
    }

    async function sendStream(body) {
      streamBuf.value = ''; thinking.value = true
      isStreaming.value = true
      // Clear leftover tool_event from previous turn
      messages.value = messages.value.filter(m => m.role !== 'tool_event')

      // Agent/Team có thể chạy NHIỀU lượt RunCompleted/TeamRunCompleted nội bộ
      // (ví dụ: team lead nhận kết quả từ member rồi tự soạn lại câu trả lời).
      // Ta chỉ muốn hiển thị câu trả lời CUỐI CÙNG khi toàn bộ stream kết thúc,
      // nên lưu lại câu trả lời hoàn chỉnh gần nhất và reset buffer sau mỗi lượt.
      let lastCompletedAnswer = ''

      // Single shared processing chip — updated in-place so user sees ONE status at a time
      const processingId = `proc-${Date.now()}`
      let processingMsg = null

      function upsertProcessing(label, ui_status, agno_event) {
        if (!processingMsg) {
          processingMsg = { id: processingId, role: 'tool_event', agno_event, ui_status, label, created_at: new Date() }
          messages.value.push(processingMsg)
        } else {
          const idx = messages.value.findIndex(m => m.id === processingId)
          if (idx !== -1) messages.value[idx] = { ...messages.value[idx], label, ui_status, agno_event }
        }
      }

      function removeProcessing() {
        messages.value = messages.value.filter(m => m.id !== processingId)
        processingMsg = null
      }

      const token2 = keycloakService.getToken() || ''
      try {
        const resp = await fetch(agnoClient.getChatStreamUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token2 ? { Authorization: `Bearer ${token2}` } : {}) },
          body: JSON.stringify(body)
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const reader = resp.body.getReader(), decoder = new TextDecoder()
        activeReader = reader
        let buf = '', currentSseEvent = 'message'

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()

          for (const line of lines) {
            if (line.startsWith('event:')) { currentSseEvent = line.slice(6).trim(); continue }
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            let payload
            try { payload = JSON.parse(raw) } catch { continue }

            // ── Envelope ────────────────────────────────────────────────────────
            const d = payload.data || {}
            const agno_event = d.agno_event || currentSseEvent
            const agui = d.agui || {}
            const ui_status = d.ui_status || agui.status || 'default'
            // Human-readable status message from agui only — never raw tool output
            const statusMsg = agui.message || ''

            if (payload.session_id) sessionId.value = payload.session_id
            if (payload.run_id) {
              lastRunId.value = payload.run_id
              if (agno_event === 'RunStarted' || currentSseEvent === 'agent_started') {
                thinking.value = false
                sessionRuns.value.unshift({ id: payload.run_id, status: 'running', created_at: new Date() })
              }
            }

            // ── Tool / status events → update single processing chip ─────────────
            const isStatus = agui.type === 'status' || [
              'TeamToolCallStarted', 'ToolCallStarted',
              'TeamToolCallCompleted', 'ToolCallCompleted',
              'ReasoningStarted', 'ReasoningCompleted',
              'RetrievalStarted', 'RetrievalCompleted'
            ].includes(agno_event)

            if (isStatus && statusMsg) {
              thinking.value = false
              upsertProcessing(statusMsg, ui_status, agno_event)
            }

            // ── Only accumulate TRUE message content (never tool output) ─────────
            // Agno marks real response content with agui.type === 'message'
            // or via RunResponse with no ui_status / tool markers
            const isRealContent = agui.type === 'message'
              || (agno_event === 'RunResponse' && !isStatus)
              || (currentSseEvent === 'agent_response' && !isStatus)

            if (isRealContent) {
              const delta = d.content || agui.content || d.delta || ''
              if (delta) {
                thinking.value = false
                removeProcessing()
                streamBuf.value += delta
              }
            }

            // ── Một lượt (Team)RunCompleted nội bộ hoàn tất ──────────────────────
            // Có thể xảy ra NHIỀU LẦN trong 1 stream (agent tự rerun/refine câu trả lời).
            // Lưu lại câu trả lời mới nhất, KHÔNG push ra chat ngay, và reset buffer
            // để token của lượt kế tiếp không bị nối dính vào câu trả lời cũ.
            if (agno_event === 'RunCompleted' || agno_event === 'TeamRunCompleted') {
              removeProcessing()
              const finalText = agui.type === 'message' ? (d.content || agui.content || '') : ''
              const candidate = finalText || streamBuf.value
              if (candidate) lastCompletedAnswer = candidate
              streamBuf.value = ''
              const run = sessionRuns.value.find(r => r.id === payload.run_id)
              if (run) run.status = 'completed'
            }

            // ── Error ────────────────────────────────────────────────────────────
            if (agno_event === 'RunError' || currentSseEvent === 'agent_error') {
              removeProcessing()
              const errMsg = agui.message || d.message || 'Stream error'
              messages.value.push({ id: Date.now().toString(), role: 'assistant', content: `[error] ${errMsg}`, created_at: new Date() })
            }

            // ── Events timeline (right panel — full detail for debugging) ────────
            streamEvents.value.unshift({
              id: `${Date.now()}-${Math.random()}`,
              agno_event,
              type: currentSseEvent,
              ui_status,
              message: statusMsg,
              detail: agui.payload ? JSON.stringify(agui.payload).substring(0, 120) : null,
              payload,
              ts: new Date()
            })
            if (streamEvents.value.length > 80) streamEvents.value.pop()
            scrollBottom()
          }
        }

        // ── Kết thúc toàn bộ stream (agent_completed): chỉ push CÂU TRẢ LỜI CUỐI CÙNG ──
        // Ưu tiên buffer hiện tại (nếu lượt cuối chưa kịp có RunCompleted riêng),
        // nếu không thì dùng câu trả lời hoàn chỉnh gần nhất đã ghi nhận.
        const finalAnswer = streamBuf.value || lastCompletedAnswer
        if (finalAnswer) {
          messages.value.push({ id: Date.now().toString(), role: 'assistant', content: finalAnswer, created_at: new Date() })
          streamBuf.value = ''
        }
        removeProcessing()
      } catch (e) {
        removeProcessing()
        messages.value.push({ id: Date.now().toString(), role: 'assistant', content: `Stream error: ${e.message}`, created_at: new Date() })
        streamBuf.value = ''
      } finally {
        thinking.value = false
        isStreaming.value = false
        activeReader = null
        scrollBottom()
      }
    }

    async function loadRunEvents(runId) {
      try {
        const evs = await agnoClient.getRunEvents(runId)
        streamEvents.value = evs.map(e => ({ id: e.id, type: e.type, payload: e.payload, ts: new Date(e.created_at) }))
        rightTab.value = 'events'
      } catch {}
    }

    async function loadMemory() {
      const agent = agentsRaw.value.find(a => a.code === agentCode.value)
      if (!agent) { $q.notify({ type: 'info', message: 'Select an Agent (not just a Team) to load memory' }); return }
      loadingMemory.value = true
      try { const r = await agnoClient.listAgentMemories(agent.id); agentMemories.value = r.items }
      catch { agentMemories.value = [] }
      finally { loadingMemory.value = false }
    }

    // Cancel an in-progress stream — POST /api/v1/runs/{run_id}/cancel (202 Accepted)
    async function cancelStream() {
      if (!isStreaming.value || !useStream.value) return
      isCancelling.value = true

      // 1. Server-side cancel
      if (lastRunId.value) {
        try {
          await agnoClient.cancelRun(lastRunId.value)
          const run = sessionRuns.value.find(r => r.id === lastRunId.value)
          if (run) run.status = 'cancelled'
        } catch (e) {
          console.warn('[cancelStream] API cancel failed:', e.message)
        }
      }

      // 2. Client-side: close the SSE reader so the while loop exits
      if (activeReader) {
        try { await activeReader.cancel() } catch {}
      }

      // 3. Flush partial buffer as a truncated message
      if (streamBuf.value) {
        messages.value.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: streamBuf.value + ' ■',
          created_at: new Date(),
          cancelled: true
        })
        streamBuf.value = ''
      }

      // Clear any lingering tool_event chip
      messages.value = messages.value.filter(m => m.role !== 'tool_event')

      streamEvents.value.unshift({
        id: Date.now().toString(),
        type: 'run_cancelled',
        payload: { run_id: lastRunId.value },
        ts: new Date()
      })

      thinking.value = false
      isStreaming.value = false
      isCancelling.value = false
      $q.notify({ type: 'info', message: 'Generation stopped', caption: lastRunId.value ? 'run: ' + lastRunId.value.substring(0, 12) + '…' : '' })
    }

    // ===== cURL builder =====
    const curlCopied = ref(false)

    function buildCurlBody(message = '<your message here>') {
      const body = {
        agentOs: agentOsCode.value || '<agentOs>',
        ...(teamCode.value ? { team: teamCode.value } : {}),
        ...(agentCode.value ? { agent: agentCode.value } : {}),
        message,
        ...(sessionId.value && sessionId.value !== 'pending' ? { session_id: sessionId.value } : {}),
        ...(userId.value ? { user_id: userId.value } : {})
      }
      return body
    }

    function buildCurl(stream = false) {
      const baseUrl = import.meta.env.VITE_AGNO_API_URL || '<AGNO_API_URL>'
      const endpoint = stream ? `${baseUrl}/api/v1/chat/stream` : `${baseUrl}/api/v1/chat`
      const body = JSON.stringify(buildCurlBody(), null, 2)
      const lines = [
        `curl -X POST '${endpoint}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -H 'Authorization: Bearer <YOUR_TOKEN>' \\`,
        ...(stream ? [`  -H 'Accept: text/event-stream' \\`] : []),
        `  -d '${body}'`
      ]
      return lines.join('\n')
    }

    function buildCancelCurl() {
      const baseUrl = import.meta.env.VITE_AGNO_API_URL || '<AGNO_API_URL>'
      const runId = lastRunId.value || '<run_id>'
      const endpoint = `${baseUrl}/api/v1/runs/${runId}/cancel`
      return [
        `curl -X POST '${endpoint}' \\`,
        `  -H 'Authorization: Bearer <YOUR_TOKEN>'`
      ].join('\n')
    }

    async function copyCurl() {
      try {
        await navigator.clipboard.writeText(buildCurl(useStream.value))
        curlCopied.value = true
        setTimeout(() => { curlCopied.value = false }, 2000)
      } catch {
        $q.notify({ type: 'negative', message: 'Copy failed — try selecting text manually' })
      }
    }

    onMounted(loadOptions)

    return { agentOsCode, agentOsOptions, teamCode, teamOptions, agentCode, agentOptions, sessionId, lastRunId, userId, userInput, thinking, streamBuf, useStream, isCancelling, isStreaming, messages, streamEvents, sessionRuns, agentMemories, loadingMemory, rightTab, msgRef, textareaRef, panelTabs, dayjs, curlCopied, buildCurl, buildCancelCurl, copyCurl, toolEventIcon, loadOptions, loadTeams, loadAgents, startSession, send, loadRunEvents, loadMemory, autoResize, cancelStream }
  }
})
</script>

<style lang="scss">
.play-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height));
  padding: 0 !important;
  overflow: hidden;
}

.play-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
  gap: 16px;
  flex-shrink: 0;

  &__divider { width: 1px; height: 20px; background: var(--border-subtle); }
}

.play-select-group { display: flex; align-items: center; gap: 6px; }

.play-mode-toggle {
  display: flex;
  background: var(--surface-sunken);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.play-mode-btn {
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 120ms ease;
  font-family: var(--font-sans);

  &--active { background: var(--surface-raised); color: var(--text-primary); box-shadow: var(--shadow-xs); }
}

.play-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.play-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
}

.play-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }
}

.play-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;

  &__icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: var(--surface-sunken);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  &__title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
  &__desc { font-size: 13px; color: var(--text-tertiary); line-height: 1.6; max-width: 360px; }
  &__user { margin-top: 12px; font-size: 11px; color: var(--text-quaternary); font-family: var(--font-mono); display: flex; align-items: center; gap: 4px; }
}

.play-msg {
  display: flex;
  gap: 10px;
  max-width: 85%;

  &--user { align-self: flex-end; flex-direction: row-reverse; }
  &--assistant { align-self: flex-start; }

  &__avatar {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--user { background: var(--brand-primary); color: white; }
    &--assistant { background: var(--surface-sunken); color: var(--text-tertiary); border: 1px solid var(--border-subtle); }
  }

  &__content { display: flex; flex-direction: column; gap: 4px; }

  &__bubble {
    padding: 10px 14px;
    font-size: 13px;
    line-height: 1.6;
    border-radius: 10px;

    &--user {
      background: var(--brand-primary);
      color: white;
      border-radius: 10px 2px 10px 10px;
    }

    &--assistant {
      background: var(--surface-raised);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      border-radius: 2px 10px 10px 10px;
    }
  }

  &__meta { font-size: 10px; color: var(--text-quaternary); padding: 0 2px; }
}

.play-thinking {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 14px 16px !important;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-quaternary);
    animation: thinking 1.2s ease infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes thinking {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.play-cursor {
  animation: blink 0.8s step-end infinite;
  font-weight: 700;
  color: var(--brand-primary);
  margin-left: 1px;
}

.play-input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-raised);
  flex-shrink: 0;
}

.play-input-box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--surface-base);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 10px 10px 10px 14px;
  transition: border-color 150ms ease;

  &:focus-within { border-color: var(--brand-primary); box-shadow: var(--shadow-focus); }
}

.play-textarea {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
  resize: none;
  line-height: 1.5;
  max-height: 160px;
  overflow-y: auto;

  &::placeholder { color: var(--text-quaternary); }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
}

.play-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--brand-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  transition: all 120ms ease;

  &:disabled { background: var(--border-default); cursor: not-allowed; }
  &:not(:disabled):hover { background: var(--brand-primary-hover); }
}

.play-stop-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--status-error-bg);
  border: 1.5px solid rgba(239,68,68,0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 150ms ease;
  position: relative;

  &:hover:not(:disabled) {
    background: var(--brand-danger);
    border-color: var(--brand-danger);
    .play-stop-btn__square { background: white; }
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }

  &--cancelling {
    background: var(--surface-sunken);
    border-color: var(--border-default);
    animation: none;
  }

  &__square {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: var(--brand-danger);
    transition: background 150ms ease;
  }
}

.play-input-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-quaternary);
  font-family: var(--font-mono);
  padding: 0 2px;
}

.play-panel {
  width: 300px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--surface-raised);

  &__tabs {
    display: flex;
    border-bottom: 1px solid var(--border-subtle);
    padding: 0 8px;
    gap: 2px;
  }

  &__tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 10px 10px;
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 120ms ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-family: var(--font-sans);

    &--active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
    &:hover:not(.play-panel__tab--active) { color: var(--text-primary); }
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 2px; }
  }
}

/* ===== Inline tool-call event (in chat stream) ===== */
.play-tool-event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  margin: 2px 0;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 12px;
  animation: fadeIn 200ms ease;
  max-width: 85%;
  align-self: flex-start;

  &--tool_call {
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.25);
    color: #92400e;
  }
  &--thinking {
    background: rgba(139, 92, 246, 0.06);
    border-color: rgba(139, 92, 246, 0.2);
    color: #5b21b6;
  }
  &--retrieving {
    background: rgba(59, 130, 246, 0.06);
    border-color: rgba(59, 130, 246, 0.2);
    color: #1e40af;
  }
  &--completed {
    background: rgba(16, 185, 129, 0.06);
    border-color: rgba(16, 185, 129, 0.2);
    color: #065f46;
    opacity: 0.7;
  }
  &--default {
    background: var(--surface-overlay);
    border-color: var(--border-subtle);
    color: var(--text-secondary);
  }
}

.play-tool-event__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.play-tool-event__body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.play-tool-event__label {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.play-tool-event__tag {
  font-size: 10px;
  font-family: var(--font-mono);
  background: rgba(0,0,0,0.06);
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
}

.play-tool-event__dots {
  display: flex;
  gap: 3px;
  align-items: center;

  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.6;
    animation: thinking 1.2s ease infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

/* ===== Events timeline (right panel) ===== */
.play-event-timeline {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
}

.play-ev {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  position: relative;

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 18px;
    bottom: -4px;
    width: 1px;
    background: var(--border-subtle);
  }
}

.play-ev__dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--border-default);
  background: var(--surface-raised);
  flex-shrink: 0;
  margin-top: 4px;

  .play-ev--tool_call & { border-color: #f59e0b; background: #fef3c7; }
  .play-ev--thinking & { border-color: #8b5cf6; background: #ede9fe; }
  .play-ev--retrieving & { border-color: #3b82f6; background: #dbeafe; }
  .play-ev--completed & { border-color: #10b981; background: #d1fae5; }
  .play-ev--error & { border-color: #ef4444; background: #fee2e2; }
}

.play-ev__body { flex: 1; min-width: 0; }

.play-ev__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 2px;
}

.play-ev__agno {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-ev__time {
  font-size: 9.5px;
  color: var(--text-quaternary);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.play-ev__msg {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.play-ev__detail {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-quaternary);
  background: var(--surface-sunken);
  border-radius: 4px;
  padding: 3px 6px;
  margin-top: 3px;
  word-break: break-all;
  white-space: pre-wrap;
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.play-run {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease;
  &:hover { background: var(--surface-sunken); }
}

.play-memory {
  background: var(--surface-overlay);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 4px;
}

/* Cancelled message styling */
.play-msg__bubble--assistant.play-msg__bubble--cancelled {
  opacity: 0.75;
  border-left: 2px solid var(--brand-danger);
  padding-left: 10px;
}

/* ===== cURL Panel ===== */
.play-curl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.play-curl__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px 10px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 6px;
}

.play-curl__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.play-curl__copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-default);
  background: var(--surface-base);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms ease;
  font-family: var(--font-sans);

  &:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
  &--copied { background: #dcfce7; border-color: #16a34a; color: #16a34a; }
}

.play-curl__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 7px;
  font-size: 11.5px;
  color: #92400e;
  margin-bottom: 4px;
}

.play-curl__section-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-quaternary);
  text-transform: uppercase;
  padding: 8px 2px 4px;
}

.play-curl__code {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px 13px;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 10.5px;
  line-height: 1.7;
  white-space: pre;
  overflow-x: auto;
  margin: 0;
  border: 1px solid rgba(255,255,255,0.06);

  &::-webkit-scrollbar { height: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

  &--dim {
    background: var(--surface-overlay);
    color: var(--text-tertiary);
    border-color: var(--border-subtle);
    font-size: 10px;
  }
}
</style>