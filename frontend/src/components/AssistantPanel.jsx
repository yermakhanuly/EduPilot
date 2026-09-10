import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { assistantApi } from '../api/client'
import { useThemeStore } from '../store/themeStore'
import { useAssistantStore } from '../store/assistantStore'
import { FormattedText } from './FormattedText'

const EMPTY_MESSAGES = []

export function AssistantPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setTheme = useThemeStore((state) => state.setTheme)
  const activeConversationId = useAssistantStore((state) => state.activeConversationId)
  const setActiveConversationId = useAssistantStore((state) => state.setActiveConversationId)

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [streamingState, setStreamingState] = useState({
    isStreaming: false,
    statusText: '',
    text: '',
    userMessageContent: '',
    abortController: null,
  })
  const streamRef = useRef(null)

  const conversationsQuery = useQuery({
    queryKey: ['assistant-conversations'],
    queryFn: () => assistantApi.listConversations(),
  })
  const conversations = conversationsQuery.data?.conversations ?? EMPTY_MESSAGES
  const selectedConversationId = conversations.some((conversation) => conversation.id === activeConversationId)
    ? activeConversationId
    : conversations[0]?.id ?? null
  const messagesQuery = useQuery({
    queryKey: ['assistant-messages', selectedConversationId],
    queryFn: () => assistantApi.messages(selectedConversationId),
    enabled: open && Boolean(selectedConversationId),
  })
  const messages = messagesQuery.data?.messages ?? EMPTY_MESSAGES

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (open && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight
    }
  }, [messages, open, streamingState.isStreaming, streamingState.text, streamingState.statusText])

  function handleStreamResult(data) {
    if (data?.conversation?.id) {
      setActiveConversationId(data.conversation.id)
      queryClient.setQueryData(['assistant-messages', data.conversation.id], (current) => ({
        ...(current ?? {}),
        conversation: data.conversation,
        messages: [
          ...(current?.messages ?? EMPTY_MESSAGES),
          ...(data.userMessage ? [data.userMessage] : []),
          ...(data.assistantMessage ? [data.assistantMessage] : []),
        ],
      }))
      queryClient.invalidateQueries({ queryKey: ['assistant-messages', data.conversation.id] })
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
    }

    if (Array.isArray(data?.clientActions)) {
      for (const action of data.clientActions) {
        if (action.type === 'set_theme') {
          setTheme(action.value)
        } else if (action.type === 'navigate') {
          navigate(action.to)
          setOpen(false)
        }
      }
    }

    if (Array.isArray(data?.invalidateQueries)) {
      for (const key of data.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    }
  }

  function startStreamTask(conversationId, content) {
    const controller = new AbortController()
    setError('')
    setStreamingState({
      isStreaming: true,
      statusText: 'Connecting...',
      text: '',
      userMessageContent: content,
      abortController: controller,
    })

    assistantApi.sendMessageStream(conversationId, content, {
      signal: controller.signal,
      onStatus: (message) => setStreamingState((s) => ({ ...s, statusText: message })),
      onDelta: (text) => setStreamingState((s) => ({ ...s, text: s.text + text, statusText: '' })),
      onDone: (data) => {
        setStreamingState({ isStreaming: false, statusText: '', text: '', userMessageContent: '', abortController: null })
        handleStreamResult(data)
      },
      onError: (err) => {
        setError(err.message)
        setStreamingState({ isStreaming: false, statusText: '', text: '', userMessageContent: '', abortController: null })
      },
    })
  }

  function stopGeneration() {
    if (streamingState.abortController) {
      streamingState.abortController.abort()
      setStreamingState({ isStreaming: false, statusText: '', text: '', userMessageContent: '', abortController: null })
      if (selectedConversationId) {
        queryClient.invalidateQueries({ queryKey: ['assistant-messages', selectedConversationId] })
      }
    }
  }

  const createConversation = useMutation({
    mutationFn: () => assistantApi.createConversation(),
    onSuccess: ({ conversation }) => {
      setActiveConversationId(conversation.id)
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
    },
  })

  // Hide on settings page
  if (location.pathname === '/app/settings') return null

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || streamingState.isStreaming) return
    setInput('')

    if (selectedConversationId) {
      startStreamTask(selectedConversationId, trimmed)
      return
    }

    createConversation.mutate(undefined, {
      onSuccess: ({ conversation }) => startStreamTask(conversation.id, trimmed),
      onError: (err) => setError(err.message),
    })
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        title="Ask EduPilot AI"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      <div className={`assistant-panel${open ? ' open' : ''}`} role="dialog" aria-label="AI Assistant">
        <div className="assistant-panel-header">
          <div>
            <span className="label">AI Assistant</span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Ask EduPilot</p>
          </div>
          <div className="assistant-panel-header-actions"><button className="icon-action" type="button" title="Open full assistant" aria-label="Open full assistant" onClick={() => { navigate('/app/assistant'); setOpen(false) }}>Expand</button><span className="pill pill-accent" style={{ fontSize: 11 }}>Claude</span></div>
        </div>

        <div className="assistant-stream assistant-panel-stream" ref={streamRef}>
          {messages.length === 0 && !streamingState.isStreaming ? (
            <div className="assistant-empty">
              <p className="muted" style={{ fontSize: 13 }}>
                Ask me anything — I can add classes, tasks, events, generate your study plan, switch themes, and more.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`assistant-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                {msg.role === 'user' ? (
                  <p className="assistant-text">{msg.content}</p>
                ) : (
                  <FormattedText text={msg.content} className="assistant-text" />
                )}
              </div>
            ))
          )}
          {streamingState.userMessageContent ? (
            <div className="assistant-bubble user">
              <p className="assistant-text">{streamingState.userMessageContent}</p>
            </div>
          ) : null}
          {streamingState.isStreaming ? (
            <div className="assistant-bubble assistant">
              {streamingState.statusText ? (
                <div className="streaming-status-badge"><span className="streaming-spinner">⚡</span> {streamingState.statusText}</div>
              ) : null}
              {streamingState.text ? (
                <FormattedText text={streamingState.text} className="assistant-text" />
              ) : (
                <p className="assistant-text muted">Thinking…</p>
              )}
            </div>
          ) : null}
        </div>

        {error && (
          <p className="pill pill-warn" style={{ margin: '0 12px', fontSize: 12 }}>
            {error}
          </p>
        )}

        <form className="assistant-panel-input" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a Math class on Monday at 9am…"
            disabled={streamingState.isStreaming}
            autoComplete="off"
          />
          {streamingState.isStreaming ? (
            <button type="button" className="ghost danger small" onClick={stopGeneration} style={{ fontSize: 12, padding: '6px 10px' }}>
              ⏹
            </button>
          ) : (
            <button type="submit" className="primary small" disabled={!input.trim()}>
              ↑
            </button>
          )}
        </form>
      </div>
    </>
  )
}
