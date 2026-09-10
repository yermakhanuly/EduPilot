import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { knowledgeApi } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

const ACCEPTED_FILES = '.pdf,.docx,.pptx,.txt,.md,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/html'
const EMPTY_DOCUMENTS = []

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function MaterialsPage() {
  usePageTitle()
  const queryClient = useQueryClient()
  const inputRefs = useRef(new Map())
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [newCourseOpen, setNewCourseOpen] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', courseCode: '' })
  const documentsQuery = useQuery({ queryKey: ['knowledge-documents'], queryFn: knowledgeApi.list })
  const coursesQuery = useQuery({ queryKey: ['knowledge-courses'], queryFn: knowledgeApi.courses })
  const documents = documentsQuery.data?.documents ?? EMPTY_DOCUMENTS
  const courses = coursesQuery.data?.courses ?? []
  const documentsByCourse = useMemo(() => {
    const grouped = new Map()
    for (const document of documents) {
      const key = document.courseId ?? 'personal'
      grouped.set(key, [...(grouped.get(key) ?? []), document])
    }
    return grouped
  }, [documents])
  const statusCounts = documents.reduce((counts, document) => ({ ...counts, [document.status]: (counts[document.status] ?? 0) + 1 }), {})

  function invalidateMaterials() {
    queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
    queryClient.invalidateQueries({ queryKey: ['knowledge-courses'] })
    queryClient.invalidateQueries({ queryKey: ['assistant-courses'] })
  }

  const upload = useMutation({
    mutationFn: ({ file, courseId }) => knowledgeApi.upload(file, courseId),
    onSuccess: invalidateMaterials,
    onError: (requestError) => setError(requestError.message),
  })
  const remove = useMutation({ mutationFn: knowledgeApi.remove, onSuccess: invalidateMaterials, onError: (requestError) => setError(requestError.message) })
  const createCourse = useMutation({
    mutationFn: knowledgeApi.createCourse,
    onSuccess: ({ course }) => {
      setCourseForm({ name: '', courseCode: '' })
      setNewCourseOpen(false)
      setExpanded((current) => new Set([...current, course.id]))
      invalidateMaterials()
    },
    onError: (requestError) => setError(requestError.message),
  })
  const retryFailed = useMutation({ mutationFn: knowledgeApi.retryFailed, onSuccess: invalidateMaterials, onError: (requestError) => setError(requestError.message) })

  function toggleCourse(courseId) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      return next
    })
  }

  function chooseFile(courseId) {
    inputRefs.current.get(courseId)?.click()
  }

  function handleFileChange(event, courseId) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    upload.mutate({ file, courseId: courseId === 'personal' ? undefined : courseId })
    event.target.value = ''
  }

  function submitCourse(event) {
    event.preventDefault()
    if (!courseForm.name.trim()) return
    createCourse.mutate({ name: courseForm.name.trim(), courseCode: courseForm.courseCode.trim() || null })
  }

  function renderDocument(document) {
    return <article className="material-row" key={document.id}><div><strong>{document.title}</strong><p className="muted small">{statusLabel(document.status)}</p>{document.errorMessage ? <p className="error-text small">{document.errorMessage}</p> : null}</div><button className="ghost small" type="button" onClick={() => remove.mutate(document.id)} disabled={remove.isPending}>Remove</button></article>
  }

  function renderCourseSection(courseId, title, subtitle) {
    const courseDocuments = documentsByCourse.get(courseId) ?? []
    const isExpanded = expanded.has(courseId)
    return <section className={`materials-course${isExpanded ? ' expanded' : ''}`} key={courseId}>
      <div className="materials-course-header">
        <button className="materials-course-toggle" type="button" onClick={() => toggleCourse(courseId)} aria-expanded={isExpanded}><span className="materials-course-arrow" aria-hidden="true">{isExpanded ? '▼' : '▶'}</span><span><strong>{title}</strong><small>{subtitle} · {courseDocuments.length} material{courseDocuments.length === 1 ? '' : 's'}</small></span></button>
        <button className="ghost small" type="button" onClick={() => chooseFile(courseId)} disabled={upload.isPending}>{upload.isPending ? 'Indexing...' : 'Upload'}</button>
        <input ref={(node) => { if (node) inputRefs.current.set(courseId, node) }} hidden type="file" accept={ACCEPTED_FILES} onChange={(event) => handleFileChange(event, courseId)} />
      </div>
      {isExpanded ? <div className="materials-course-content">{courseDocuments.length ? courseDocuments.map(renderDocument) : <p className="muted small">No materials yet. Upload a file to start building this course library.</p>}</div> : null}
    </section>
  }

  return <section className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">Knowledge base</p><h1>Course materials</h1><p className="muted">Organize Canvas and personal study materials for the AI coach.</p>{documents.length ? <p className="muted small">Ready: {statusCounts.ready ?? 0} · Processing: {statusCounts.processing ?? 0} · Failed: {statusCounts.failed ?? 0}</p> : null}</div><div className="materials-actions"><button className="primary" type="button" onClick={() => setNewCourseOpen((open) => !open)}>{newCourseOpen ? 'Cancel' : 'New course'}</button><button className="ghost" type="button" onClick={() => retryFailed.mutate()} disabled={retryFailed.isPending || !statusCounts.failed}>{retryFailed.isPending ? 'Retrying...' : `Retry failed${statusCounts.failed ? ` (${statusCounts.failed})` : ''}`}</button></div></div>
    {newCourseOpen ? <form className="panel material-course-form" onSubmit={submitCourse}><label className="form-field"><span>Course title</span><input value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} placeholder="Introduction to Finance" required /></label><label className="form-field"><span>Course code <small>(optional)</small></span><input value={courseForm.courseCode} onChange={(event) => setCourseForm({ ...courseForm, courseCode: event.target.value })} placeholder="GE2260" /></label><button className="primary" type="submit" disabled={createCourse.isPending}>{createCourse.isPending ? 'Creating...' : 'Create course'}</button></form> : null}
    {error ? <p className="error-text">{error}</p> : null}
    {documentsQuery.isLoading || coursesQuery.isLoading ? <p className="muted">Loading course materials...</p> : null}
    {!documentsQuery.isLoading && !coursesQuery.isLoading ? <div className="materials-course-list">{courses.map((course) => renderCourseSection(course.id, course.courseCode ? `${course.courseCode} · ${course.name}` : course.name, course.source === 'manual' ? 'Personal course' : 'Canvas course'))}{renderCourseSection('personal', 'Personal Study Materials', 'Not assigned to a course')}</div> : null}
  </section>
}
