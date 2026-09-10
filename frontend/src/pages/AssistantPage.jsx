import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assistantApi } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAssistantStore } from '../store/assistantStore'
import { FormattedText } from '../components/FormattedText'

const EMPTY_MESSAGES = []

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function AssistantPage() {
  usePageTitle()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const activeId = useAssistantStore((state) => state.activeConversationId)
  const setActiveId = useAssistantStore((state) => state.setActiveConversationId)
  const [draft, setDraft] = useState('')
  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [pendingMessage, setPendingMessage] = useState(null)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState(null)
  const [conversationListOpen, setConversationListOpen] = useState(false)
  const streamRef = useRef(null)

  const conversationsQuery = useQuery({
    queryKey: ['assistant-conversations', search],
    queryFn: () => assistantApi.listConversations(search),
  })
  const coursesQuery = useQuery({ queryKey: ['assistant-courses'], queryFn: assistantApi.courses })
  const conversations = conversationsQuery.data?.conversations ?? []
  const displayedActiveId = conversations.some((conversation) => conversation.id === activeId)
    ? activeId
    : conversations[0]?.id ?? null
  const messagesQuery = useQuery({
    queryKey: ['assistant-messages', displayedActiveId],
    queryFn: () => assistantApi.messages(displayedActiveId),
    enabled: Boolean(displayedActiveId),
  })

  const refreshConversations = () => queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
  const createConversation = useMutation({
    mutationFn: () => assistantApi.createConversation(),
    onSuccess: ({ conversation }) => {
      setActiveId(conversation.id)
      setConversationListOpen(false)
      refreshConversations()
    },
  })
  const renameConversation = useMutation({
    mutationFn: ({ id, title }) => assistantApi.updateConversation(id, { title }),
    onSuccess: () => {
      setRenameId(null)
      refreshConversations()
    },
  })
  const deleteConversation = useMutation({
    mutationFn: assistantApi.removeConversation,
    onSuccess: (_data, id) => {
      if (id === activeId) setActiveId(null)
      refreshConversations()
    },
  })
  const sendMessage = useMutation({
    mutationFn: ({ id, content }) => assistantApi.sendMessage(id, content),
    onSuccess: ({ conversation, userMessage, assistantMessage }) => {
      setPendingMessage(null)
      setActiveId(conversation.id)
      queryClient.setQueryData(['assistant-messages', conversation.id], (current) => ({
        ...(current ?? {}),
        conversation,
        messages: [...(current?.messages ?? EMPTY_MESSAGES), userMessage, assistantMessage],
      }))
      queryClient.invalidateQueries({ queryKey: ['assistant-messages', conversation.id] })
      refreshConversations()
    },
    onError: () => setPendingMessage((message) => message ? { ...message, failed: true } : null),
  })
  const branchMessage = useMutation({
    mutationFn: ({ id, content }) => assistantApi.branchMessage(id, content),
    onSuccess: ({ conversation }) => {
      setEditingMessageId(null)
      setEditingContent('')
      setActiveId(conversation.id)
      queryClient.invalidateQueries({ queryKey: ['assistant-messages', conversation.id] })
      refreshConversations()
    },
  })
  const regenerateMessage = useMutation({
    mutationFn: assistantApi.regenerateMessage,
    onMutate: (messageId) => setRegeneratingMessageId(messageId),
    onSuccess: ({ conversation }) => {
      setActiveId(conversation.id)
      queryClient.invalidateQueries({ queryKey: ['assistant-messages', conversation.id] })
      refreshConversations()
    },
    onSettled: () => setRegeneratingMessageId(null),
  })
  const updateCourseContext = useMutation({
    mutationFn: ({ id, courseId }) => assistantApi.updateConversation(id, { courseId }),
    onSuccess: ({ conversation }) => {
      queryClient.setQueryData(['assistant-messages', conversation.id], (current) => ({ ...current, conversation }))
      refreshConversations()
    },
  })

  const messages = messagesQuery.data?.messages ?? EMPTY_MESSAGES
  const activeConversation = messagesQuery.data?.conversation ?? conversations.find((conversation) => conversation.id === displayedActiveId)
  const courses = coursesQuery.data?.courses ?? []

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingMessage, sendMessage.isPending, regeneratingMessageId])

  function submitMessage(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !displayedActiveId || sendMessage.isPending) return
    setDraft('')
    setPendingMessage({ id: `pending-${Date.now()}`, content })
    sendMessage.mutate({ id: displayedActiveId, content })
  }

  return (
    <section className={`assistant-workspace${conversationListOpen ? ' conversations-open' : ''}`}>
      <aside className="conversation-sidebar">
        <div className="conversation-sidebar-top">
          <div>
            <p className="eyebrow">AI workspace</p>
            <h2>Conversations</h2>
          </div>
          <div className="conversation-sidebar-actions"><button className="ghost small conversation-drawer-close" type="button" onClick={() => setConversationListOpen(false)}>Close</button><button className="primary small" type="button" onClick={() => createConversation.mutate()} disabled={createConversation.isPending}>New chat</button></div>
        </div>
        <input className="conversation-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chat titles" aria-label="Search chat titles" />
        <div className="conversation-list">
          {conversationsQuery.isLoading ? <p className="muted small">Loading chats...</p> : null}
          {!conversationsQuery.isLoading && !conversations.length ? <p className="muted small">Start a chat to keep your study questions organized.</p> : null}
          {conversations.map((conversation) => (
            <article className={`conversation-row${conversation.id === displayedActiveId ? ' active' : ''}`} key={conversation.id}>
              <button type="button" className="conversation-select" onClick={() => { setActiveId(conversation.id); setConversationListOpen(false) }}>
                <strong>{conversation.title}</strong>
                <span>{conversation.course?.courseCode ?? conversation.course?.name ?? 'All materials'} · {formatDate(conversation.updatedAt)}</span>
              </button>
              <div className="conversation-row-actions">
                <button type="button" className="icon-action" title="Rename conversation" aria-label="Rename conversation" onClick={() => { setRenameId(conversation.id); setRenameValue(conversation.title) }}>Edit</button>
                <button type="button" className="icon-action danger" title="Delete conversation" aria-label="Delete conversation" onClick={() => { if (window.confirm(`Delete “${conversation.title}”? This cannot be undone.`)) deleteConversation.mutate(conversation.id) }}>Delete</button>
              </div>
              {renameId === conversation.id ? <form className="conversation-rename" onSubmit={(event) => { event.preventDefault(); if (renameValue.trim()) renameConversation.mutate({ id: conversation.id, title: renameValue.trim() }) }}><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /><button className="ghost small" type="submit">Save</button></form> : null}
            </article>
          ))}
        </div>
      </aside>

      <div className="conversation-main">
        {activeConversation ? <>
          <header className="conversation-header">
            <div><p className="eyebrow">Claude · Study coach</p><h1>{activeConversation.title}</h1></div>
            <button className="ghost small conversation-drawer-toggle" type="button" onClick={() => setConversationListOpen(true)}>Chats</button>
            <label className="conversation-course">Course context<select value={activeConversation.courseId ?? ''} disabled={updateCourseContext.isPending} onChange={(event) => updateCourseContext.mutate({ id: activeConversation.id, courseId: event.target.value || null })}><option value="">All materials</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.courseCode ? `${course.courseCode} · ${course.name}` : course.name}</option>)}</select><span>{updateCourseContext.isPending ? 'Saving course context...' : ''}</span></label>
          </header>
          <div className="conversation-stream" ref={streamRef}>
            {messagesQuery.isLoading ? <p className="muted">Loading messages...</p> : null}
            {!messagesQuery.isLoading && !messages.length ? <div className="assistant-page-empty"><h3>What are you working on?</h3><p>Ask about a course outline, organize your deadlines, or create a study plan.</p></div> : null}
            {messages.map((message) => <article className={`conversation-message ${message.role}`} key={message.id}>
              {editingMessageId === message.id ? <form className="message-edit-form" onSubmit={(event) => { event.preventDefault(); if (editingContent.trim()) branchMessage.mutate({ id: message.id, content: editingContent.trim() }) }}><textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows="3" autoFocus /><div><button className="ghost small" type="button" onClick={() => setEditingMessageId(null)}>Cancel</button><button className="primary small" type="submit" disabled={branchMessage.isPending}>Save and regenerate</button></div></form> : <>{message.role === 'user' ? <><p>{message.content}</p><button className="message-edit-button" type="button" onClick={() => { setEditingMessageId(message.id); setEditingContent(message.content) }}>Edit and regenerate</button></> : <><FormattedText text={message.content} /><div className="assistant-message-controls"><button className="message-edit-button" type="button" onClick={() => navigator.clipboard.writeText(message.content)}>Copy</button><button className="message-edit-button" type="button" onClick={() => regenerateMessage.mutate(message.id)} disabled={regenerateMessage.isPending}>{regeneratingMessageId === message.id ? 'Regenerating...' : 'Regenerate'}</button></div></>}</>}
              {Array.isArray(message.actions) && message.actions.length ? <div className="message-actions">{message.actions.map((action) => <span key={action.summary}>{action.summary}</span>)}</div> : null}
              {Array.isArray(message.sources) && message.sources.length ? <details className="message-sources"><summary>Sources ({message.sources.length})</summary>{message.sources.map((source, index) => <div className="message-source" key={`${source.documentId ?? source.title}-${source.chunkIndex ?? index}`}><strong>{source.title}</strong><span>{source.sourceType.replaceAll('_', ' ')}{source.pageNumber ? ` · page ${source.pageNumber}` : ''}{source.slideNumber ? ` · slide ${source.slideNumber}` : ''}{source.heading ? ` · ${source.heading}` : ''}</span><p>{source.excerpt}</p></div>)}</details> : null}
            </article>)}
            {pendingMessage ? <article className={`conversation-message user${pendingMessage.failed ? ' failed' : ''}`}><p>{pendingMessage.content}</p>{pendingMessage.failed ? <button className="message-edit-button" type="button" onClick={() => { setDraft(pendingMessage.content); setPendingMessage(null) }}>Retry message</button> : null}</article> : null}
            {sendMessage.isPending ? <article className="conversation-message assistant"><p className="muted">Thinking...</p></article> : null}
            {regenerateMessage.isPending ? <article className="conversation-message assistant regeneration-status"><p className="muted">Regenerating response...</p></article> : null}
          </div>
          {sendMessage.error || branchMessage.error || regenerateMessage.error || updateCourseContext.error ? <p className="error-text">{sendMessage.error?.message ?? branchMessage.error?.message ?? regenerateMessage.error?.message ?? updateCourseContext.error?.message}</p> : null}
          <form className="conversation-composer" onSubmit={submitMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your schedule or course materials..." rows="2" disabled={sendMessage.isPending} /><button className="primary" type="submit" disabled={!draft.trim() || sendMessage.isPending}>Send</button></form>
        </> : <div className="assistant-page-empty"><h1>Your study conversations</h1><p>Create a chat to ask questions, use course materials, or manage your plan.</p><button className="primary" type="button" onClick={() => createConversation.mutate()}>New chat</button></div>}
      </div>
    </section>
  )
}