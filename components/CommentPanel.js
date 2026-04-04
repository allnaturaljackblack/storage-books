'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { format } from 'date-fns'

export default function CommentPanel({ transactionId, onClose }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!transactionId) return
    loadComments()
  }, [transactionId])

  async function loadComments() {
    const { data } = await supabase
      .from('transaction_comments')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function addComment(e) {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('transaction_comments').insert({
      transaction_id: transactionId,
      user_id: user.id,
      body: body.trim(),
    })
    setBody('')
    await loadComments()
    setLoading(false)
  }

  async function deleteComment(id) {
    await supabase.from('transaction_comments').delete().eq('id', id)
    await loadComments()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-80 flex flex-col max-h-[60vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-sm text-slate-900">Comments</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {comments.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">No comments yet</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-sm text-slate-800">{c.body}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-400">
                  {format(new Date(c.created_at), 'MMM d, h:mm a')}
                </span>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addComment} className="px-4 py-3 border-t border-slate-100 flex gap-2">
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Post
          </button>
        </form>
      </div>
    </div>
  )
}
