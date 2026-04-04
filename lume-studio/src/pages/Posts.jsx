import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '../lib/constants'
import { softDelete, softDeleteBulk, ENTITY_TYPES } from '../lib/trash'

export default function Posts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('lume-posts-view') || 'board')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  // Templates
  const [templates, setTemplates] = useState([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateInitial, setTemplateInitial] = useState({})
  const templatePickerRef = useRef(null)

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    fetchPosts()
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (!showTemplatePicker) return
    function handleClick(e) {
      if (templatePickerRef.current && !templatePickerRef.current.contains(e.target)) setShowTemplatePicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTemplatePicker])

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreate(true)
      setSearchParams({}, { replace: true })
    }
    const s = searchParams.get('status')
    if (s && s !== filterStatus) setFilterStatus(s)
  }, [searchParams])

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('id, title, type, status, platform, created_at, scheduled_date, post_categories(category:categories(id,name,color))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function fetchTemplates() {
    const { data } = await supabase.from('post_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function handleCreate(fields) {
    const { data, error } = await supabase.from('posts').insert(fields).select('id, title, type, status, platform, created_at, scheduled_date').single()
    if (!error && data) {
      setPosts(prev => [data, ...prev])
      setShowCreate(false)
      window.dispatchEvent(new CustomEvent('lume-posts-updated'))
      navigate(`/posts/${data.id}`)
    }
  }

  async function handleDelete() {
    const target = deleteTarget
    setDeleteTarget(null)
    setPosts(prev => prev.filter(p => p.id !== target.id))
    await softDelete(ENTITY_TYPES.POST, target.id, target.title)
  }

  async function handleEdit(fields) {
    const { error } = await supabase.from('posts').update(fields).eq('id', editTarget.id)
    if (!error) {
      setPosts(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...fields } : p))
      setEditTarget(null)
      window.dispatchEvent(new CustomEvent('lume-posts-updated'))
    }
  }

  async function handleDeleteFromEdit() {
    const target = editTarget
    setEditTarget(null)
    setPosts(prev => prev.filter(p => p.id !== target.id))
    await softDelete(ENTITY_TYPES.POST, target.id, target.title)
  }

  async function handleScheduleChange(postId, newDate) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduled_date: newDate } : p))
    const { error } = await supabase.from('posts').update({ scheduled_date: newDate }).eq('id', postId)
    if (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduled_date: post.scheduled_date } : p))
    }
  }

  async function handleStatusChange(postId, newStatus) {
    const post = posts.find(p => p.id === postId)
    if (!post || post.status === newStatus) return
    // Move to front of array so it appears at top of the new column
    setPosts(prev => [
      { ...post, status: newStatus },
      ...prev.filter(p => p.id !== postId),
    ])
    const { error } = await supabase.from('posts').update({ status: newStatus }).eq('id', postId)
    if (error) {
      // Rollback: restore original status and position
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: post.status } : p))
    } else {
      window.dispatchEvent(new CustomEvent('lume-posts-updated'))
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function deselectAll() {
    setSelectedIds(new Set())
    setSelectMode(false)
    setConfirmBulkDelete(false)
  }

  async function bulkStatusChange(status) {
    const ids = [...selectedIds]
    setPosts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status } : p))
    await supabase.from('posts').update({ status }).in('id', ids)
    window.dispatchEvent(new CustomEvent('lume-posts-updated'))
  }

  async function bulkDelete() {
    setBulkProcessing(true)
    const ids = [...selectedIds]
    setPosts(prev => prev.filter(p => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setBulkProcessing(false)
    await softDeleteBulk(ENTITY_TYPES.POST, ids, `${ids.length} post${ids.length !== 1 ? 's' : ''}`)
    window.dispatchEvent(new CustomEvent('lume-posts-updated'))
  }

  const anySelected = selectedIds.size > 0
  const filtered = filterStatus === 'all' ? posts : posts.filter(p => p.status === filterStatus)

  return (
    <div className="p-7">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-serif text-3xl text-stone-800">Posts</h1>
          <p className="text-xs text-stone-400 mt-1">
            {posts.length} post{posts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode !== 'calendar' && (
            <button
              onClick={() => { setSelectMode(!selectMode); if (selectMode) deselectAll(); }}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                selectMode
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              {selectMode ? 'Done' : 'Select'}
            </button>
          )}
          <div className="flex border border-stone-200 rounded-md overflow-hidden">
            <button
              onClick={() => { setViewMode('board'); localStorage.setItem('lume-posts-view', 'board') }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'board' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              Board
            </button>
            <button
              onClick={() => { setViewMode('grid'); localStorage.setItem('lume-posts-view', 'grid') }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              Grid
            </button>
            <button
              onClick={() => { setViewMode('calendar'); localStorage.setItem('lume-posts-view', 'calendar') }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              Calendar
            </button>
          </div>
          <div className="relative" ref={templatePickerRef}>
            <div className="flex">
              <button
                onClick={() => { setTemplateInitial({}); setShowCreate(true) }}
                className="bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-l-md hover:opacity-90 transition-opacity"
              >
                + New Post
              </button>
              {templates.length > 0 && (
                <button
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className="bg-stone-800 text-white text-xs font-medium px-2 py-2 rounded-r-md border-l border-stone-600 hover:opacity-90 transition-opacity"
                >
                  ▾
                </button>
              )}
              {templates.length === 0 && <span className="rounded-r-md" />}
            </div>
            {showTemplatePicker && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg min-w-[200px] py-1 z-20">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 px-3 py-1.5">From Template</p>
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTemplateInitial({
                        type: t.type || [],
                        platform: t.platform || [],
                        status: t.status || 'idea',
                        description: t.description || '',
                        caption: t.caption || '',
                      })
                      setShowCreate(true)
                      setShowTemplatePicker(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status filter — only in grid view */}
      {viewMode === 'grid' && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterStatus === 'all'
                ? 'bg-stone-800 text-white border-stone-800'
                : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            All
          </button>
          {Object.entries(POST_STATUSES).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filterStatus === key
                  ? 'text-white border-transparent'
                  : 'border-stone-200 text-stone-500 hover:border-stone-400'
              }`}
              style={filterStatus === key ? { backgroundColor: s.color } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {anySelected && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs">
          <span className="text-stone-600 font-medium">{selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button onClick={deselectAll} className="text-stone-400 hover:text-stone-600 transition-colors">Deselect all</button>
          <div className="ml-auto flex items-center gap-2">
            {confirmBulkDelete ? (
              <>
                <span className="text-stone-500">Delete {selectedIds.size} post{selectedIds.size !== 1 ? 's' : ''}?</span>
                <button onClick={() => setConfirmBulkDelete(false)} className="text-stone-400 hover:text-stone-600 px-2 py-1 border border-stone-200 rounded transition-colors">Cancel</button>
                <button onClick={bulkDelete} disabled={bulkProcessing} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40 transition-colors">
                  {bulkProcessing ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </>
            ) : (
              <>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { bulkStatusChange(e.target.value); e.target.value = ''; } }}
                  className="text-xs border border-stone-200 text-stone-600 bg-white px-2 py-1 rounded outline-none cursor-pointer"
                >
                  <option value="" disabled>Set status…</option>
                  {Object.entries(POST_STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="border border-red-200 text-red-400 px-3 py-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          posts={posts}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          onNavigate={(id) => navigate(`/posts/${id}`)}
          onScheduleChange={handleScheduleChange}
        />
      ) : viewMode === 'board' ? (
        <KanbanBoard
          posts={posts}
          onNavigate={(id) => navigate(`/posts/${id}`)}
          onEdit={(post) => setEditTarget(post)}
          onDelete={(post) => setDeleteTarget(post)}
          onStatusChange={handleStatusChange}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-4xl mb-4">▷</p>
          <p className="text-sm font-medium mb-1">No posts</p>
          <p className="text-xs">Create a post to start planning content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => selectMode ? toggleSelect(post.id) : navigate(`/posts/${post.id}`)}
              onEdit={(e) => { e.stopPropagation(); setEditTarget(post) }}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(post) }}
              selectMode={selectMode}
              checked={selectedIds.has(post.id)}
              anySelected={anySelected}
              onCheck={(e) => { e.stopPropagation(); toggleSelect(post.id) }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <PostModal initial={templateInitial} onSave={handleCreate} onClose={() => { setShowCreate(false); setTemplateInitial({}) }} />
      )}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {editTarget && (
        <EditPostModal
          post={editTarget}
          onSave={handleEdit}
          onDelete={handleDeleteFromEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

/* ── Calendar View ───────────────────────────────────────── */

function generateCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    cells.push({ date: new Date(year, month - 1, d), isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  while (cells.length < 42) {
    const d = cells.length - firstDay - daysInMonth + 1
    cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
  }
  return cells
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarView({ posts, calendarMonth, setCalendarMonth, onNavigate, onScheduleChange }) {
  const [dragOverDate, setDragOverDate] = useState(null)
  const [expandedDate, setExpandedDate] = useState(null)

  const { year, month } = calendarMonth
  const cells = generateCalendarGrid(year, month)
  const todayStr = toDateStr(new Date())

  const scheduled = posts.filter(p => p.scheduled_date)
  const unscheduled = posts.filter(p => !p.scheduled_date)

  const postsByDate = {}
  scheduled.forEach(p => {
    const key = p.scheduled_date
    if (!postsByDate[key]) postsByDate[key] = []
    postsByDate[key].push(p)
  })

  function prevMonth() {
    setCalendarMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 })
  }

  function nextMonth() {
    setCalendarMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 })
  }

  function goToday() {
    const now = new Date()
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  function handleDragStart(e, postId) {
    e.dataTransfer.setData('text/plain', postId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, dateStr) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverDate !== dateStr) setDragOverDate(dateStr)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverDate(null)
    }
  }

  function handleDrop(e, dateStr) {
    e.preventDefault()
    setDragOverDate(null)
    const postId = e.dataTransfer.getData('text/plain')
    if (postId) onScheduleChange(postId, dateStr)
  }

  function handleUnscheduleDrop(e) {
    e.preventDefault()
    setDragOverDate(null)
    const postId = e.dataTransfer.getData('text/plain')
    if (postId) onScheduleChange(postId, null)
  }

  const MAX_VISIBLE = 2

  return (
    <div>
      {/* Calendar header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="w-7 h-7 rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50 flex items-center justify-center text-sm transition-colors">←</button>
        <h2 className="text-sm font-semibold text-stone-700 w-40 text-center">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={nextMonth} className="w-7 h-7 rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50 flex items-center justify-center text-sm transition-colors">→</button>
        <button onClick={goToday} className="text-xs text-stone-400 hover:text-amber-700 transition-colors ml-1">Today</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-[10px] font-medium text-stone-400 uppercase tracking-wider text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-stone-200">
        {cells.map((cell, i) => {
          const dateStr = toDateStr(cell.date)
          const dayPosts = postsByDate[dateStr] || []
          const isToday = dateStr === todayStr
          const isOver = dragOverDate === dateStr

          return (
            <div
              key={i}
              className={`border-r border-b border-stone-200 min-h-[100px] p-1.5 transition-colors ${
                !cell.isCurrentMonth ? 'bg-stone-50' : ''
              } ${isOver ? 'bg-amber-50 ring-2 ring-inset ring-amber-300' : ''}`}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dateStr)}
            >
              <div className={`text-xs mb-1 ${
                isToday ? 'bg-amber-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-medium' :
                cell.isCurrentMonth ? 'text-stone-600' : 'text-stone-300'
              }`}>
                {cell.date.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayPosts.slice(0, MAX_VISIBLE).map(p => {
                  const status = POST_STATUSES[p.status]
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onClick={() => onNavigate(p.id)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-white border border-stone-100 cursor-pointer hover:border-stone-300 transition-colors truncate"
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#b0a090' }} />
                      <span className="truncate text-stone-600">{p.title}</span>
                    </div>
                  )
                })}
                {dayPosts.length > MAX_VISIBLE && (
                  <button
                    onClick={() => setExpandedDate(expandedDate === dateStr ? null : dateStr)}
                    className="text-[10px] text-stone-400 hover:text-amber-700 text-left px-1.5 transition-colors"
                  >
                    +{dayPosts.length - MAX_VISIBLE} more
                  </button>
                )}
                {expandedDate === dateStr && dayPosts.slice(MAX_VISIBLE).map(p => {
                  const status = POST_STATUSES[p.status]
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onClick={() => onNavigate(p.id)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-white border border-stone-100 cursor-pointer hover:border-stone-300 transition-colors truncate"
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#b0a090' }} />
                      <span className="truncate text-stone-600">{p.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unscheduled posts */}
      <div
        className={`mt-6 p-4 rounded-xl transition-colors ${dragOverDate === '__unschedule__' ? 'bg-stone-100 ring-2 ring-stone-300' : 'bg-stone-50'}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverDate !== '__unschedule__') setDragOverDate('__unschedule__') }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDate(null) }}
        onDrop={handleUnscheduleDrop}
      >
        <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-2">
          Unscheduled ({unscheduled.length})
        </p>
        {unscheduled.length === 0 ? (
          <p className="text-xs text-stone-300">All posts are scheduled. Drag posts here to unschedule.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(p => {
              const status = POST_STATUSES[p.status]
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onClick={() => onNavigate(p.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-stone-200 cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#b0a090' }} />
                  <span className="text-stone-600">{p.title}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Kanban Board ────────────────────────────────────────── */

function KanbanBoard({ posts, onNavigate, onEdit, onDelete, onStatusChange, selectMode, selectedIds, onToggleSelect }) {
  const [dragOverCol, setDragOverCol] = useState(null)

  function handleDragStart(e, postId) {
    e.dataTransfer.setData('text/plain', postId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, statusKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== statusKey) setDragOverCol(statusKey)
  }

  function handleDragLeave(e, statusKey) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null)
    }
  }

  function handleDrop(e, statusKey) {
    e.preventDefault()
    setDragOverCol(null)
    const postId = e.dataTransfer.getData('text/plain')
    if (postId) onStatusChange(postId, statusKey)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {Object.entries(POST_STATUSES).map(([key, status]) => {
        const columnPosts = posts.filter(p => p.status === key)
        return (
          <div
            key={key}
            className={`flex-1 min-w-[220px] max-w-[320px] rounded-xl p-3 transition-colors ${
              dragOverCol === key ? 'bg-stone-100 ring-2 ring-stone-300' : 'bg-stone-50'
            }`}
            onDragOver={(e) => handleDragOver(e, key)}
            onDragLeave={(e) => handleDragLeave(e, key)}
            onDrop={(e) => handleDrop(e, key)}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
              <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{status.label}</span>
              <span className="text-[10px] text-stone-400 ml-auto">{columnPosts.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnPosts.map(post => (
                <KanbanCard
                  key={post.id}
                  post={post}
                  onDragStart={handleDragStart}
                  onClick={() => selectMode ? onToggleSelect(post.id) : onNavigate(post.id)}
                  onEdit={() => onEdit(post)}
                  onDelete={() => onDelete(post)}
                  selectMode={selectMode}
                  checked={selectedIds.has(post.id)}
                  anySelected={selectedIds.size > 0}
                  onCheck={(e) => { e.stopPropagation(); onToggleSelect(post.id) }}
                />
              ))}
              {columnPosts.length === 0 && (
                <p className="text-xs text-stone-300 text-center py-8">Drop posts here</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ post, onDragStart, onClick, onEdit, onDelete, selectMode, checked, anySelected, onCheck }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cats = (post.post_categories || []).map(pc => pc.category).filter(Boolean)

  return (
    <div
      draggable={!selectMode}
      onDragStart={(e) => !selectMode && onDragStart(e, post.id)}
      onClick={onClick}
      className={`bg-white border rounded-lg p-3 cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all ${
        checked ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-200'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
          {(selectMode || anySelected) && (
            <input
              type="checkbox"
              checked={checked}
              onChange={onCheck}
              onClick={e => e.stopPropagation()}
              className="accent-amber-500 flex-shrink-0"
            />
          )}
          <p className="text-sm font-medium text-stone-700 truncate">{post.title}</p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="w-5 h-5 rounded text-stone-300 hover:text-stone-600 flex items-center justify-center text-sm transition-colors"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
              <div className="absolute top-6 right-0 z-20 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Edit Post
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  Delete Post
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {post.type?.length > 0 && (
        <p className="text-[11px] text-stone-400 mb-1">{post.type.join(', ')}</p>
      )}
      {post.platform?.length > 0 && (
        <p className="text-[10px] text-stone-400">{post.platform.join(' · ')}</p>
      )}
      {cats.length > 0 && (
        <div className="flex gap-1 mt-2">
          {cats.slice(0, 6).map(cat => (
            <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, onClick, onEdit, onDelete, selectMode, checked, anySelected, onCheck }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = POST_STATUSES[post.status]
  const cats = (post.post_categories || []).map(pc => pc.category).filter(Boolean)

  return (
    <button
      onClick={onClick}
      className={`relative text-left bg-white border rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all ${
        checked ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stone-200'
      }`}
    >
      {(selectMode || anySelected) && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            onClick={e => e.stopPropagation()}
            className="accent-amber-500"
          />
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: (status?.color || '#b0a090') + '30', color: status?.color || '#b0a090' }}
        >
          {status?.label || post.status}
        </span>
        <div className="flex items-center gap-1.5">
          {post.platform?.length > 0 && (
            <span className="text-[10px] text-stone-400 text-right">{post.platform.join(', ')}</span>
          )}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="w-5 h-5 rounded text-stone-300 hover:text-stone-600 flex items-center justify-center text-sm transition-colors"
            >
              ⋮
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
                <div className="absolute top-6 right-0 z-20 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={(e) => { setMenuOpen(false); onEdit(e) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Edit Post
                  </button>
                  <button
                    onClick={(e) => { setMenuOpen(false); onDelete(e) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete Post
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm font-medium text-stone-700 truncate mb-0.5">{post.title}</p>

      {post.type?.length > 0 && (
        <p className="text-xs text-stone-400">{post.type.join(', ')}</p>
      )}

      {cats.length > 0 && (
        <div className="flex gap-1 mt-2">
          {cats.slice(0, 6).map(cat => (
            <span key={cat.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          ))}
        </div>
      )}
    </button>
  )
}

function PostModal({ initial = {}, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || '')
  const [types, setTypes] = useState(initial.type || [])
  const [platforms, setPlatforms] = useState(initial.platform || [])
  const [status, setStatus] = useState(initial.status || 'idea')
  const [description, setDescription] = useState(initial.description || '')
  const [caption, setCaption] = useState(initial.caption || '')
  const [scheduledDate, setScheduledDate] = useState(initial.scheduled_date || '')
  const [saving, setSaving] = useState(false)
  const isFromTemplate = !!(initial.type?.length || initial.platform?.length || initial.caption)

  function toggleItem(arr, setArr, item) {
    setArr(arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      type: types.length > 0 ? types : null,
      platform: platforms.length > 0 ? platforms : null,
      status,
      description: description.trim() || null,
      caption: caption.trim() || null,
      scheduled_date: scheduledDate || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-5">{isFromTemplate ? 'New Post from Template' : 'New Post'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lisbon sunset reel"
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
            />
          </Field>
          <Field label="Status">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(POST_STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                  style={status === key
                    ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                    : { borderColor: '#e7e5e4', color: '#78716c' }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPES.map(t => (
                <button key={t} type="button" onClick={() => toggleItem(types, setTypes, t)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${types.includes(t) ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Platform">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => toggleItem(platforms, setPlatforms, p)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${platforms.includes(p) ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Caption">
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Post caption…"
              rows={2}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none transition-colors"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Quick notes or context…"
              rows={2}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 resize-none transition-colors"
            />
          </Field>
          <Field label="Schedule Date">
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-serif text-xl text-stone-800 mb-2">Delete post?</h2>
        <p className="text-sm text-stone-500 mb-6">
          "<span className="font-medium text-stone-700">{name}</span>" and all its assets will be permanently deleted.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-md hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

function EditPostModal({ post, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(post.title || '')
  const [types, setTypes] = useState(post.type || [])
  const [platforms, setPlatforms] = useState(post.platform || [])
  const [status, setStatus] = useState(post.status || 'idea')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function toggleItem(arr, setArr, item) {
    setArr(arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), type: types.length > 0 ? types : null, platform: platforms.length > 0 ? platforms : null, status })
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="font-serif text-xl text-stone-800 mb-1">Edit Post</h2>
          <p className="text-xs text-stone-400 mb-5">{post.title}</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Title">
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-400 transition-colors"
              />
            </Field>
            <Field label="Type">
              <div className="flex flex-wrap gap-1.5">
                {POST_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => toggleItem(types, setTypes, t)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${types.includes(t) ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Platform">
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} type="button" onClick={() => toggleItem(platforms, setPlatforms, p)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${platforms.includes(p) ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-700 outline-none bg-white focus:border-stone-400 transition-colors"
              >
                {Object.entries(POST_STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-stone-200 text-stone-500 text-sm py-2 rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
              <button type="submit" disabled={!title.trim() || saving} className="flex-1 bg-stone-800 text-white text-sm py-2 rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
        <div className="px-6 pb-6 pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400 mb-2">Danger zone</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full border border-red-200 text-red-400 text-xs font-medium py-2 rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-500 disabled:opacity-40 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
