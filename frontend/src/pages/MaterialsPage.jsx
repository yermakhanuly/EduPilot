import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { knowledgeApi } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

export function MaterialsPage() {
  usePageTitle()
  const inputRef = useRef(null)
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [materialsVisible, setMaterialsVisible] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: knowledgeApi.list,
  })
  const upload = useMutation({
    mutationFn: (file) => knowledgeApi.upload(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] }),
    onError: (requestError) => setError(requestError.message),
  })
  const remove = useMutation({
    mutationFn: knowledgeApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] }),
  })

  function onFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    upload.mutate(file)
    event.target.value = ''
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Knowledge base</p>
          <h1>Course materials</h1>
          <p className="muted">Upload PDF, DOCX, PPTX, or text materials for the AI coach to search.</p>
        </div>
        <div className="materials-actions">
          <button className="primary" type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? 'Indexing...' : 'Upload material'}
          </button>
          <button className="ghost" type="button" onClick={() => setMaterialsVisible((visible) => !visible)}>
            {materialsVisible ? 'Hide materials' : `Show materials${data?.documents?.length ? ` (${data.documents.length})` : ''}`}
          </button>
        </div>
        <input ref={inputRef} hidden type="file" accept=".pdf,.docx,.pptx,.txt,.md,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/html" onChange={onFileChange} />
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {materialsVisible ? (
        <>
          {isLoading ? <p className="muted">Loading materials...</p> : null}
          {!isLoading && !data?.documents?.length ? <p className="muted">No materials indexed yet.</p> : null}
          <div className="list-stack">
            {data?.documents?.map((document) => (
              <article className="list-row" key={document.id}>
                <div>
                  <strong>{document.title}</strong>
                  <p className="muted small">{document.course?.name ?? 'General material'} · {document.status}</p>
                  {document.errorMessage ? <p className="error-text small">{document.errorMessage}</p> : null}
                </div>
                <button className="ghost small" type="button" onClick={() => remove.mutate(document.id)} disabled={remove.isPending}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
