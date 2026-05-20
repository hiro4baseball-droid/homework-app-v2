import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import {
  BookOpen, Users, ClipboardList, Plus, Trash2,
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  School, ArrowLeft, Loader, Camera, X, GraduationCap,
  FileText, Image, Key, CalendarDays, Circle,
  AlertCircle, RefreshCw, Copy, Sparkles, Pencil,
} from 'lucide-react'
import { analyzeHomeworkPhotos, generateParentReport, getApiKeys } from './aiClient'

const SUBJECTS = ['数学', '国語', '英語', '理科', '社会', '音楽', '美術', '体育', 'その他']
const SUBJECT_COLORS = {
  '数学': '#2d5a27', '国語': '#8b3a3a', '英語': '#1a4a6b',
  '理科': '#4a6b1a', '社会': '#6b4a1a', '音楽': '#6b1a5a',
  '美術': '#1a5a6b', '体育': '#5a6b1a', 'その他': '#5a5a5a',
}

function photoUrl(path) {
  const { data } = supabase.storage.from('homework-photos').getPublicUrl(path)
  return data.publicUrl
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── UI部品 ──────────────────────────────────────

function Btn({ onClick, children, color = 'accent', small, danger, outline, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '6px 12px' : '9px 18px',
      border: outline ? '1px solid var(--border)' : 'none',
      borderRadius: '10px',
      background: danger ? 'var(--danger)' : outline ? 'transparent' : `var(--${color})`,
      color: outline ? 'var(--text-muted)' : '#fff',
      fontWeight: 700, fontSize: small ? '0.8rem' : '0.88rem',
      opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  )
}

function Badge({ children, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}30`,
    }}>{children}</span>
  )
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '10px',
        background: 'var(--accent-light)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '0.95rem', outline: 'none', background: 'var(--bg)',
  boxSizing: 'border-box',
}

// ── 保護者レポートモーダル ───────────────────────────
function ParentReportModal({ student, school, onClose }) {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`
  const [month, setMonth] = useState(defaultMonth)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setGenerating(true)
    setError('')
    setReport('')
    try {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const [{ data: subs }, { data: tasks }, { data: hw }] = await Promise.all([
        supabase.from('submissions').select('*, homework(title)').eq('student_id', student.id),
        supabase.from('student_tasks').select('*').eq('student_id', student.id).eq('completed', true)
          .gte('completed_at', monthStart).lte('completed_at', monthEnd),
        supabase.from('homework').select('*').eq('school_id', school.id),
      ])

      const thisMonthSubs = (subs || []).filter(s =>
        s.submitted && s.submitted_at && s.submitted_at >= monthStart && s.submitted_at <= monthEnd
      )
      const total = (hw || []).length
      const tasksDone = (tasks || []).length
      const homeworkDetails = thisMonthSubs.map(s => s.homework?.title).filter(Boolean)

      const text = await generateParentReport(student.name, month, {
        submitted: thisMonthSubs.length, total, tasksDone, homeworkDetails,
      })
      if (!text) throw new Error('AIからの応答が空でした。しばらく待ってから再試行してください')
      setReport(text)
    } catch (e) {
      setError(e.message)
    }
    setGenerating(false)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal title={`${student.name} — 保護者レポート生成`} onClose={onClose}>
      <Field label="対象月">
        <input style={inputStyle} value={month} onChange={e => setMonth(e.target.value)} placeholder="例: 2025年5月" />
      </Field>

      {!report && (
        <Btn onClick={generate} disabled={generating}>
          {generating ? <Loader size={14} /> : <Sparkles size={14} />}
          {generating ? 'AI生成中...' : 'レポートを生成'}
        </Btn>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e53e3e', fontSize: '0.85rem', marginTop: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {report && (
        <>
          <div style={{
            padding: '16px', background: 'var(--surface2)', borderRadius: 10,
            fontSize: '0.9rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginTop: 12,
            border: '1px solid var(--border)',
          }}>
            {report}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn onClick={copyToClipboard}>
              <Copy size={14} />
              {copied ? 'コピーしました ✓' : 'コピー'}
            </Btn>
            <Btn outline onClick={() => { setReport(''); setError('') }}>
              <RefreshCw size={14} />再生成
            </Btn>
          </div>
        </>
      )}
    </Modal>
  )
}

function PhotoGrid({ photos, onDelete }) {
  const [lightbox, setLightbox] = useState(null)
  if (photos.length === 0) return null
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
        {photos.map(p => (
          <div key={p.id} style={{
            position: 'relative', aspectRatio: '1',
            borderRadius: 8, overflow: 'hidden',
            background: 'var(--surface2)', cursor: 'pointer',
          }}>
            <img
              src={photoUrl(p.file_path)} alt={p.file_name}
              onClick={() => setLightbox(p)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.opacity = '0.3' }}
            />
            {onDelete && (
              <button onClick={e => { e.stopPropagation(); onDelete(p) }} style={{
                position: 'absolute', top: 3, right: 3,
                background: 'rgba(0,0,0,0.65)', border: 'none',
                borderRadius: '50%', width: 20, height: 20, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}><X size={11} /></button>
            )}
          </div>
        ))}
      </div>
      {lightbox && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000,
        }} onClick={() => setLightbox(null)}>
          <img
            src={photoUrl(lightbox.file_path)} alt={lightbox.file_name}
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: '50%', width: 40, height: 40, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><X size={20} /></button>
          <div style={{ position: 'absolute', bottom: 20, color: '#fff', fontSize: '0.82rem', opacity: 0.6 }}>
            {lightbox.file_name}
          </div>
        </div>
      )}
    </>
  )
}

// ── モード選択 ────────────────────────────────────

function ModeSelect({ onSelect }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <BookOpen size={36} color="var(--accent)" />
          <span style={{ fontSize: '1.9rem', fontWeight: 700 }}>宿題提出管理</span>
        </div>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>どちらの画面を使いますか？</p>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { key: 'teacher', icon: <School size={44} />, label: '先生', desc: '校舎・生徒・宿題の管理', color: 'var(--accent)' },
          { key: 'student', icon: <GraduationCap size={44} />, label: '生徒', desc: '宿題の確認・写真提出', color: '#7c3aed' },
        ].map(({ key, icon, label, desc, color }) => (
          <button key={key} onClick={() => onSelect(key)} style={{
            background: 'var(--surface)', border: `2px solid ${color}22`,
            borderRadius: '20px', padding: '40px 56px', textAlign: 'center',
            cursor: 'pointer', minWidth: 210, transition: 'all 0.2s',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = color
              e.currentTarget.style.boxShadow = `0 10px 36px ${color}22`
              e.currentTarget.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `${color}22`
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{ color, marginBottom: 16 }}>{icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 校舎一覧 ────────────────────────────────────

function SchoolList({ onSelect }) {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [editingSchool, setEditingSchool] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { fetchSchools() }, [])

  async function fetchSchools() {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').order('created_at')
    setSchools(data || [])
    setLoading(false)
  }

  async function addSchool() {
    if (!name.trim()) return
    await supabase.from('schools').insert({ name: name.trim() })
    setName(''); setShowAdd(false); fetchSchools()
  }

  async function renameSchool() {
    if (!editName.trim() || !editingSchool) return
    await supabase.from('schools').update({ name: editName.trim() }).eq('id', editingSchool.id)
    setEditingSchool(null); setEditName(''); fetchSchools()
  }

  async function deleteSchool(id) {
    if (!confirm('この校舎を削除しますか？（生徒・宿題データもすべて削除されます）')) return
    await supabase.from('schools').delete().eq('id', id)
    fetchSchools()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>校舎一覧</h2>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />校舎を追加</Btn>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Loader size={24} />
        </div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          校舎がありません。「校舎を追加」から始めてください。
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {schools.map(s => (
            <div key={s.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '20px', cursor: 'pointer',
            }}
              onClick={() => onSelect(s)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px',
                    background: 'var(--accent-light)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
                  }}><School size={20} /></div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={e => { e.stopPropagation(); setEditingSchool(s); setEditName(s.name) }} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer', borderRadius: 6,
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  ><Pencil size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteSchool(s.id) }} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer', borderRadius: 6,
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  ><Trash2 size={15} /></button>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                クリックして管理 →
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <Modal title="校舎を追加" onClose={() => setShowAdd(false)}>
          <Field label="校舎名">
            <input style={inputStyle} placeholder="例：渋谷校" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSchool()} autoFocus />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn outline onClick={() => setShowAdd(false)}>キャンセル</Btn>
            <Btn onClick={addSchool}>追加する</Btn>
          </div>
        </Modal>
      )}
      {editingSchool && (
        <Modal title="校舎名を変更" onClose={() => setEditingSchool(null)}>
          <Field label="新しい校舎名">
            <input style={inputStyle} value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameSchool()} autoFocus />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn outline onClick={() => setEditingSchool(null)}>キャンセル</Btn>
            <Btn onClick={renameSchool}>変更する</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── 校舎詳細 ────────────────────────────────────

function SchoolDetail({ school, onBack }) {
  const [tab, setTab] = useState('homework')
  const [students, setStudents] = useState([])
  const [homework, setHomework] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [photoSubmissions, setPhotoSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddHW, setShowAddHW] = useState(false)
  const [showAddSt, setShowAddSt] = useState(false)

  useEffect(() => { fetchAll() }, [school.id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: st }, { data: hw }, { data: sub }] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', school.id).order('created_at'),
      supabase.from('homework').select('*').eq('school_id', school.id).order('deadline'),
      supabase.from('submissions').select('*'),
    ])
    const hwList = hw || []
    const hwIds = hwList.map(h => h.id)
    let photos = []
    if (hwIds.length > 0) {
      const { data } = await supabase.from('photo_submissions')
        .select('*, students(name)')
        .in('homework_id', hwIds)
      photos = data || []
    }
    setStudents(st || [])
    setHomework(hwList)
    setSubmissions(sub || [])
    setPhotoSubmissions(photos)
    setLoading(false)
  }

  async function addStudent(name) {
    await supabase.from('students').insert({ name, school_id: school.id })
    fetchAll()
  }

  async function deleteStudent(id) {
    if (!confirm('この生徒を削除しますか？')) return
    await supabase.from('students').delete().eq('id', id)
    fetchAll()
  }

  async function updateStudentPin(id, pin) {
    await supabase.from('students').update({ pin: pin || null }).eq('id', id)
    fetchAll()
  }

  async function addHomework(form) {
    const { data: hw } = await supabase.from('homework').insert({
      title: form.title, subject: form.subject,
      deadline: form.deadline, scope: form.scope,
      school_id: school.id,
    }).select().single()
    if (hw) {
      const subs = students.map(s => ({ homework_id: hw.id, student_id: s.id, submitted: false }))
      if (subs.length > 0) await supabase.from('submissions').insert(subs)
    }
    fetchAll()
  }

  async function deleteHomework(id) {
    if (!confirm('この宿題を削除しますか？')) return
    await supabase.from('homework').delete().eq('id', id)
    fetchAll()
  }

  async function toggleSubmission(hwId, studentId) {
    const existing = submissions.find(s => s.homework_id === hwId && s.student_id === studentId)
    const newVal = existing ? !existing.submitted : true
    const now = newVal ? new Date().toISOString() : null
    if (existing) {
      await supabase.from('submissions').update({ submitted: newVal, submitted_at: now }).eq('id', existing.id)
    } else {
      await supabase.from('submissions').insert({ homework_id: hwId, student_id: studentId, submitted: true, submitted_at: now })
    }
    fetchAll()
  }

  const totalSubmitted = submissions.filter(s => s.submitted).length
  const totalPossible = homework.length * students.length
  const overallRate = totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 100) : 0
  const notSubmittedStudents = students.filter(s =>
    homework.some(hw => {
      const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
      return !sub || !sub.submitted
    })
  )

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 20, padding: 0, cursor: 'pointer',
      }}>
        <ArrowLeft size={16} /> 校舎一覧に戻る
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '12px',
          background: 'var(--accent-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
        }}><School size={22} /></div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{school.name}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<ClipboardList size={20} />} label="宿題数" value={homework.length} />
        <StatCard icon={<Users size={20} />} label="生徒数" value={students.length} />
        <StatCard icon={<CheckCircle size={20} />} label="全体提出率" value={`${overallRate}%`} />
        <StatCard icon={<XCircle size={20} />} label="未提出ありの生徒" value={notSubmittedStudents.length} sub="いずれかの宿題で未提出" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'homework', label: '宿題一覧', icon: <ClipboardList size={15} /> },
          { key: 'students', label: '生徒管理', icon: <Users size={15} /> },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', border: 'none', borderRadius: '8px',
            background: tab === key ? 'var(--accent)' : 'transparent',
            color: tab === key ? '#fff' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}>{icon}{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : tab === 'homework' ? (
        <HomeworkTab
          homework={homework} students={students} submissions={submissions}
          photoSubmissions={photoSubmissions}
          onAdd={addHomework} onDelete={deleteHomework} onToggle={toggleSubmission}
          showAdd={showAddHW} setShowAdd={setShowAddHW}
          onRefresh={fetchAll}
        />
      ) : (
        <StudentsTab
          school={school}
          students={students} homework={homework} submissions={submissions}
          onAdd={addStudent} onDelete={deleteStudent} onUpdatePin={updateStudentPin}
          showAdd={showAddSt} setShowAdd={setShowAddSt}
        />
      )}
    </div>
  )
}

// ── 宿題タブ ────────────────────────────────────

function HomeworkTab({ homework, students, submissions, photoSubmissions, onAdd, onDelete, onToggle, showAdd, setShowAdd, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const subjects = [...new Set(homework.map(h => h.subject))]
  const filtered = filter === 'all' ? homework : homework.filter(h => h.subject === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...subjects].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 14px', borderRadius: '999px',
              border: '1px solid var(--border)',
              background: filter === s ? 'var(--accent)' : 'var(--surface)',
              color: filter === s ? '#fff' : 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}>{s === 'all' ? 'すべて' : s}</button>
          ))}
        </div>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />宿題を追加</Btn>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>宿題がありません</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(hw => (
            <HomeworkCard key={hw.id} hw={hw} students={students} submissions={submissions}
              photoSubmissions={photoSubmissions}
              onToggle={onToggle} onDelete={onDelete} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {showAdd && <AddHomeworkModal onAdd={onAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ── 宿題カード（先生用）────────────────────────────

function HomeworkCard({ hw, students, submissions, photoSubmissions, onToggle, onDelete, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [editingScope, setEditingScope] = useState(false)
  const [scope, setScope] = useState(hw.scope || '')
  const color = SUBJECT_COLORS[hw.subject] || '#5a5a5a'
  const isOverdue = new Date(hw.deadline) < new Date()
  const myPhotos = photoSubmissions.filter(p => p.homework_id === hw.id)

  const submitted = students.filter(s => {
    const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
    return sub?.submitted
  })
  const notSubmitted = students.filter(s => {
    const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
    return !sub?.submitted
  })
  const rate = students.length > 0 ? Math.round((submitted.length / students.length) * 100) : 0

  async function saveScope() {
    await supabase.from('homework').update({ scope }).eq('id', hw.id)
    setEditingScope(false)
  }

  const photosByStudent = myPhotos.reduce((acc, p) => {
    const name = p.students?.name || '不明'
    if (!acc[name]) acc[name] = []
    acc[name].push(p)
    return acc
  }, {})

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px' }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <Badge color={color}>{hw.subject}</Badge>
              {isOverdue && <Badge color="#c0392b">期限超過</Badge>}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{hw.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>締め切り：{hw.deadline}</div>
          </div>
          <button onClick={() => onDelete(hw.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          ><Trash2 size={16} /></button>
        </div>

        {/* 課題範囲 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileText size={12} />課題範囲
            </span>
            <button
              onClick={() => editingScope ? saveScope() : setEditingScope(true)}
              style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              {editingScope ? '保存' : '編集'}
            </button>
          </div>
          {editingScope ? (
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontSize: '0.88rem' }}
              value={scope}
              onChange={e => setScope(e.target.value)}
              placeholder="例：教科書 p.50-60、問1〜5"
              autoFocus
              onKeyDown={e => e.key === 'Escape' && setEditingScope(false)}
            />
          ) : (
            <div style={{
              padding: '9px 12px', borderRadius: 8, minHeight: 38,
              background: scope ? 'var(--accent-light)' : 'var(--surface2)',
              borderLeft: scope ? '3px solid var(--accent)' : '3px solid var(--border)',
              fontSize: '0.88rem', whiteSpace: 'pre-wrap',
              color: scope ? 'inherit' : 'var(--text-muted)',
            }}>
              {scope || '未設定 — 「編集」から入力'}
            </div>
          )}
        </div>

        {/* 提出率 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              提出済み <strong style={{ color: 'var(--accent)' }}>{submitted.length}</strong> / {students.length} 人
            </span>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--mono)', fontWeight: 700, color }}>{rate}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* 生徒の提出状況 */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 20px', background: 'var(--surface2)',
        border: 'none', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
      }}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? '閉じる' : '生徒の提出状況を見る'}
      </button>

      {open && (
        <div style={{ padding: '16px 20px 20px' }}>
          {notSubmitted.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>⚠ 未提出 ({notSubmitted.length}人)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {notSubmitted.map(s => (
                  <button key={s.id} onClick={() => onToggle(hw.id, s.id)} style={{
                    padding: '5px 12px', borderRadius: '999px',
                    border: '1px solid var(--danger)', background: 'var(--danger-light)',
                    color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                  }} title="クリックで提出済みにする">{s.name}</button>
                ))}
              </div>
            </div>
          )}
          {submitted.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>✓ 提出済み ({submitted.length}人)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {submitted.map(s => {
                  const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
                  const aiPass = sub?.ai_status === 'pass'
                  const aiResubmit = sub?.needs_resubmit
                  return (
                    <div key={s.id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button onClick={() => onToggle(hw.id, s.id)} style={{
                        padding: '5px 12px', borderRadius: '999px',
                        border: `1px solid ${aiResubmit ? '#dd6b20' : 'var(--accent)'}`,
                        background: aiResubmit ? '#fff8f0' : 'var(--accent-light)',
                        color: aiResubmit ? '#dd6b20' : 'var(--accent)',
                        fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                      }} title="クリックで未提出に戻す">{s.name}</button>
                      <span style={{ fontSize: '0.62rem', color: aiResubmit ? '#dd6b20' : aiPass ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {aiResubmit ? '⚠ 要再提出' : aiPass ? '✓ AI確認済' : ''}
                      </span>
                      {sub?.submitted_at && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          {fmtDate(sub.submitted_at)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 提出写真 */}
      <button onClick={() => setPhotoOpen(o => !o)} style={{
        width: '100%', padding: '10px 20px', background: 'var(--surface2)',
        border: 'none', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
      }}>
        {photoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <Camera size={13} />
        提出写真を見る（{myPhotos.length}枚）
      </button>

      {photoOpen && (
        <div style={{ padding: '16px 20px 20px' }}>
          {myPhotos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '0.88rem' }}>
              写真の提出はありません
            </div>
          ) : (
            Object.entries(photosByStudent).map(([studentName, photos]) => (
              <div key={studentName} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                  {studentName}（{photos.length}枚）
                </div>
                <PhotoGrid photos={photos} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── 宿題追加モーダル ────────────────────────────

function AddHomeworkModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ title: '', subject: '数学', deadline: '', scope: '' })
  const handle = () => {
    if (!form.title || !form.deadline) return alert('タイトルと締め切りを入力してください')
    onAdd(form); onClose()
  }
  return (
    <Modal title="宿題を追加" onClose={onClose}>
      <Field label="宿題名">
        <input style={inputStyle} placeholder="例：数学プリント②" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
      </Field>
      <Field label="締め切り">
        <input style={inputStyle} type="date" value={form.deadline}
          onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </Field>
      <Field label="科目">
        <select style={inputStyle} value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="課題範囲（任意）">
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontSize: '0.88rem' }}
          placeholder="例：教科書 p.50-60、問1〜5"
          value={form.scope}
          onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
        />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn outline onClick={onClose}>キャンセル</Btn>
        <Btn onClick={handle}>追加する</Btn>
      </div>
    </Modal>
  )
}

// ── 先生用：生徒タスク閲覧 ──────────────────────────
function TeacherStudentTasksView({ studentId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('student_tasks')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at')
      .then(({ data }) => {
        setTasks(data || [])
        setLoading(false)
      })
  }, [studentId])

  const pending = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: '#faf8ff',
      padding: '10px 20px 14px',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <ClipboardList size={13} /> 個人タスク
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}><Loader size={14} /></div>
      ) : tasks.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>タスクはありません</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...pending, ...done].map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {task.completed
                ? <CheckCircle size={14} color="#7c3aed" />
                : <Circle size={14} color="var(--text-muted)" />
              }
              <span style={{
                fontSize: '0.85rem',
                color: task.completed ? 'var(--text-muted)' : 'var(--text)',
                textDecoration: task.completed ? 'line-through' : 'none',
              }}>{task.title}</span>
              {task.due_date && (
                <span style={{
                  fontSize: '0.75rem',
                  color: task.completed ? 'var(--text-muted)' : (new Date(task.due_date) < new Date() ? '#e53e3e' : 'var(--text-muted)'),
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <CalendarDays size={11} />{task.due_date}
                </span>
              )}
              {task.completed && task.completed_at && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 2 }}>
                  完了: {new Date(task.completed_at).toLocaleDateString('ja-JP')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 生徒タブ ────────────────────────────────────

function StudentsTab({ school, students, homework, submissions, onAdd, onDelete, onUpdatePin, showAdd, setShowAdd }) {
  const [name, setName] = useState('')
  const [editingPin, setEditingPin] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [expandedTasks, setExpandedTasks] = useState(null)
  const [reportStudent, setReportStudent] = useState(null)

  const handle = () => {
    if (!name.trim()) return
    onAdd(name.trim()); setName(''); setShowAdd(false)
  }

  function startEditPin(s) {
    setEditingPin(s.id)
    setPinInput(s.pin || '')
  }

  async function savePin(studentId) {
    await onUpdatePin(studentId, pinInput)
    setEditingPin(null)
    setPinInput('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 700 }}>生徒一覧 ({students.length}人)</span>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />生徒を追加</Btn>
      </div>

      {students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>生徒がいません</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {students.map((s, i) => {
            const notSubmitted = homework.filter(hw => {
              const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
              return !sub?.submitted
            })
            return (
              <div key={s.id} style={{ borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--accent-light)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                  }}>{s.name[0]}</div>

                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                    {notSubmitted.length > 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 2 }}>
                        未提出: {notSubmitted.map(h => h.title).join('、')}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: 2 }}>すべて提出済み ✓</div>
                    )}
                  </div>

                  {/* PIN管理 */}
                  {editingPin === s.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="text"
                        maxLength={6}
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="数字6桁"
                        style={{
                          width: 90, padding: '5px 8px', textAlign: 'center',
                          border: '1px solid var(--accent)', borderRadius: 6,
                          fontSize: '0.88rem', fontFamily: 'var(--mono)', outline: 'none',
                          background: 'var(--bg)',
                        }}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') savePin(s.id)
                          if (e.key === 'Escape') setEditingPin(null)
                        }}
                      />
                      <button onClick={() => savePin(s.id)} style={{
                        fontSize: '0.75rem', color: '#fff', background: 'var(--accent)',
                        border: 'none', borderRadius: 6, padding: '5px 10px', fontWeight: 700, cursor: 'pointer',
                      }}>保存</button>
                      <button onClick={() => setEditingPin(null)} style={{
                        fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
                      }}>×</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: '999px',
                        background: s.pin ? 'var(--accent-light)' : 'var(--surface2)',
                        border: `1px solid ${s.pin ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        <Key size={11} color={s.pin ? 'var(--accent)' : 'var(--text-muted)'} />
                        <span style={{
                          fontSize: '0.8rem', fontFamily: 'var(--mono)', fontWeight: 700,
                          color: s.pin ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                          {s.pin || '未設定'}
                        </span>
                      </div>
                      <button onClick={() => startEditPin(s)} style={{
                        fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none',
                        border: 'none', cursor: 'pointer', textDecoration: 'underline',
                      }}>
                        {s.pin ? '変更' : 'PINを設定'}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setExpandedTasks(expandedTasks === s.id ? null : s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: expandedTasks === s.id ? 'var(--accent-light)' : 'none',
                      border: '1px solid var(--border)', borderRadius: 8,
                      padding: '4px 10px', fontSize: '0.78rem',
                      color: expandedTasks === s.id ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    <ClipboardList size={13} />タスク
                    {expandedTasks === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button
                    onClick={() => setReportStudent(s)}
                    title="保護者レポートを生成"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '4px 10px', fontSize: '0.78rem', color: 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Sparkles size={13} />レポート
                  </button>
                  <button onClick={() => onDelete(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  ><Trash2 size={15} /></button>
                </div>
                {expandedTasks === s.id && (
                  <TeacherStudentTasksView studentId={s.id} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="生徒を追加" onClose={() => setShowAdd(false)}>
          <Field label="生徒名">
            <input style={inputStyle} placeholder="例：山田 太郎" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()} autoFocus />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn outline onClick={() => setShowAdd(false)}>キャンセル</Btn>
            <Btn onClick={handle}>追加する</Btn>
          </div>
        </Modal>
      )}

      {reportStudent && (
        <ParentReportModal
          student={reportStudent}
          school={school}
          onClose={() => setReportStudent(null)}
        />
      )}
    </div>
  )
}

// ── 生徒自己登録 ──────────────────────────────────

function StudentRegister({ school, onSuccess, onBack }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function register() {
    if (!name.trim()) return setError('名前を入力してください')
    if (!pin) return setError('PINを入力してください')
    if (pin.length < 4) return setError('PINは4桁以上にしてください')
    if (pin !== confirmPin) return setError('PINが一致しません')

    setLoading(true)
    setError('')

    // 同名チェック
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', school.id)
      .eq('name', name.trim())
      .maybeSingle()

    if (existing) {
      setError('その名前はすでに登録されています')
      setLoading(false)
      return
    }

    // 生徒を登録
    const { data: newStudent, error: err } = await supabase
      .from('students')
      .insert({ name: name.trim(), school_id: school.id, pin })
      .select()
      .single()

    if (err || !newStudent) {
      setError('登録に失敗しました。もう一度試してください。')
      setLoading(false)
      return
    }

    // 既存の宿題に対してsubmissionレコードを作成
    const { data: hwList } = await supabase
      .from('homework')
      .select('id')
      .eq('school_id', school.id)

    if (hwList && hwList.length > 0) {
      await supabase.from('submissions').insert(
        hwList.map(hw => ({ homework_id: hw.id, student_id: newStudent.id, submitted: false }))
      )
    }

    setLoading(false)
    onSuccess(newStudent) // PINは設定済みなのでそのまま自動ログイン
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '20px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 32, padding: 0, cursor: 'pointer',
      }}>
        <ArrowLeft size={16} /> 名前一覧に戻る
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px',
          background: '#7c3aed18', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#7c3aed',
        }}><School size={20} /></div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>新規登録</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{school.name}</div>
        </div>
      </div>

      <Field label="名前">
        <input
          style={inputStyle}
          placeholder="例：山田 太郎"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && register()}
          autoFocus
        />
      </Field>

      <Field label="PIN（4〜6桁の数字）">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          style={{ ...inputStyle, fontFamily: 'var(--mono)', letterSpacing: '0.2em', fontSize: '1.1rem' }}
          placeholder="••••••"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
        />
      </Field>

      <Field label="PINの確認">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          style={{
            ...inputStyle,
            fontFamily: 'var(--mono)', letterSpacing: '0.2em', fontSize: '1.1rem',
            borderColor: confirmPin && pin !== confirmPin ? 'var(--danger)' : 'var(--border)',
          }}
          placeholder="••••••"
          value={confirmPin}
          onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError('') }}
          onKeyDown={e => e.key === 'Enter' && register()}
        />
        {confirmPin && pin !== confirmPin && (
          <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 4 }}>PINが一致しません</div>
        )}
      </Field>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'var(--danger-light)', color: 'var(--danger)',
          fontSize: '0.85rem', marginBottom: 16,
        }}>{error}</div>
      )}

      <Btn onClick={register} disabled={loading || !name || !pin || !confirmPin}>
        {loading ? <Loader size={15} /> : <GraduationCap size={15} />}
        {loading ? '登録中...' : '登録する'}
      </Btn>
    </div>
  )
}

// ── PIN認証 ──────────────────────────────────────

function StudentPINEntry({ student, onSuccess, onBack }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  // PIN未設定ならそのまま通過
  if (!student.pin) {
    onSuccess()
    return null
  }

  function verify() {
    if (pin === student.pin) {
      setError(false)
      onSuccess()
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '0 auto', padding: '40px 20px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 40, padding: 0, cursor: 'pointer',
      }}>
        <ArrowLeft size={16} /> 名前選択に戻る
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: '#7c3aed18', color: '#7c3aed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', fontWeight: 700,
        }}>{student.name[0]}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 6 }}>{student.name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 28 }}>
          PINを入力してログイン
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={e => { setPin(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && pin && verify()}
          placeholder="••••••"
          autoFocus
          style={{
            ...inputStyle,
            textAlign: 'center',
            fontSize: '1.8rem',
            letterSpacing: '0.25em',
            padding: '14px',
            marginBottom: 8,
            borderColor: error ? 'var(--danger)' : 'var(--border)',
          }}
        />

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 16, fontWeight: 600 }}>
            PINが違います。もう一度試してください。
          </div>
        )}

        <div style={{ marginTop: error ? 0 : 16 }}>
          <Btn onClick={verify} disabled={!pin} color="accent">
            <Key size={15} />ログイン
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── 生徒モード ────────────────────────────────────

function StudentMode({ onTeacher }) {
  const [school, setSchool] = useState(null)
  const [student, setStudent] = useState(null)
  const [pinVerified, setPinVerified] = useState(false)
  const [registering, setRegistering] = useState(false)

  if (!school) return <StudentSchoolSelect onSelect={setSchool} onTeacher={onTeacher} />

  if (!student) {
    if (registering) return (
      <StudentRegister
        school={school}
        onSuccess={newStudent => {
          setStudent(newStudent)
          setPinVerified(true) // 登録時にPINを設定済みなので認証不要
          setRegistering(false)
        }}
        onBack={() => setRegistering(false)}
      />
    )
    return (
      <StudentNameSelect
        school={school}
        onSelect={setStudent}
        onRegister={() => setRegistering(true)}
        onBack={() => setSchool(null)}
      />
    )
  }

  if (!pinVerified) return (
    <StudentPINEntry
      student={student}
      onSuccess={() => setPinVerified(true)}
      onBack={() => setStudent(null)}
    />
  )
  return (
    <StudentHomeworkList
      school={school}
      student={student}
      onBack={() => { setStudent(null); setPinVerified(false) }}
    />
  )
}

function StudentSchoolSelect({ onSelect, onTeacher }) {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('schools').select('*').order('created_at').then(({ data }) => {
      setSchools(data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>あなたの校舎を選んでください</h2>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Loader size={24} /></div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>校舎がありません</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {schools.map(s => (
            <button key={s.id} onClick={() => onSelect(s)} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '24px 20px', textAlign: 'left',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '10px',
                  background: 'var(--accent-light)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0,
                }}><School size={20} /></div>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <button onClick={onTeacher} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline',
          opacity: 0.6,
        }}>
          先生の方はこちら
        </button>
      </div>
    </div>
  )
}

function StudentNameSelect({ school, onSelect, onRegister, onBack }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('students').select('*').eq('school_id', school.id).order('created_at').then(({ data }) => {
      setStudents(data || [])
      setLoading(false)
    })
  }, [school.id])

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 24, padding: 0, cursor: 'pointer',
      }}>
        <ArrowLeft size={16} /> 校舎選択に戻る
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '10px',
          background: 'var(--accent-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
        }}><School size={18} /></div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{school.name} — 名前を選んでください</h2>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Loader size={24} /></div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 16 }}>まだ登録された生徒がいません</div>
          <Btn onClick={onRegister}><GraduationCap size={15} />最初に登録する</Btn>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {students.map((s, i) => (
            <button key={s.id} onClick={() => onSelect(s)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px', background: 'none', border: 'none',
              borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#7c3aed18', color: '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
              }}>{s.name[0]}</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* 新規登録リンク */}
      {students.length > 0 && (
        <div style={{
          marginTop: 20, padding: '16px 20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            名前が見つからない場合
          </span>
          <Btn small onClick={onRegister}>
            <Plus size={14} />新規登録
          </Btn>
        </div>
      )}
    </div>
  )
}

function StudentHomeworkList({ school, student, onBack }) {
  const [homework, setHomework] = useState([])
  const [photos, setPhotos] = useState([])
  const [notes, setNotes] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [student.id, school.id])

  async function fetchData() {
    setLoading(true)
    const [{ data: hw }, { data: ph }, { data: nt }, { data: subs }] = await Promise.all([
      supabase.from('homework').select('*').eq('school_id', school.id).order('deadline'),
      supabase.from('photo_submissions').select('*').eq('student_id', student.id),
      supabase.from('student_scope_notes').select('*').eq('student_id', student.id),
      supabase.from('submissions').select('*').eq('student_id', student.id),
    ])
    setHomework(hw || [])
    setPhotos(ph || [])
    setNotes(nt || [])
    setSubmissions(subs || [])
    setLoading(false)
  }

  function addPhoto(hwId, photo) {
    setPhotos(prev => [...prev, photo])
  }
  function removePhoto(photoId) {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }
  function updateNote(hwId, note) {
    setNotes(prev => {
      const existing = prev.find(n => n.homework_id === hwId)
      if (existing) return prev.map(n => n.homework_id === hwId ? { ...n, note } : n)
      return [...prev, { homework_id: hwId, note }]
    })
  }
  function updateSubmission(sub) {
    setSubmissions(prev => {
      const exists = prev.find(s => s.homework_id === sub.homework_id)
      if (exists) return prev.map(s => s.homework_id === sub.homework_id ? sub : s)
      return [...prev, sub]
    })
  }

  return (
    <div>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 24, padding: 0, cursor: 'pointer',
      }}>
        <ArrowLeft size={16} /> 名前選択に戻る
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '12px',
          background: '#7c3aed18', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#7c3aed',
        }}><GraduationCap size={22} /></div>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{student.name}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{school.name}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Loader size={24} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {homework.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              宿題が登録されていません
            </div>
          ) : homework.map(hw => (
            <StudentHomeworkCard
              key={hw.id}
              hw={hw}
              student={student}
              photos={photos.filter(p => p.homework_id === hw.id)}
              scopeNote={notes.find(n => n.homework_id === hw.id)}
              submission={submissions.find(s => s.homework_id === hw.id)}
              onAddPhoto={(photo) => addPhoto(hw.id, photo)}
              onRemovePhoto={removePhoto}
              onNoteChange={(note) => updateNote(hw.id, note)}
              onSubmit={updateSubmission}
            />
          ))}
          <StudentTaskSection student={student} />
        </div>
      )}
    </div>
  )
}

function StudentTaskSection({ student }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('student_tasks')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at')
      .then(({ data }) => {
        setTasks(data || [])
        setLoading(false)
      })
  }, [student.id])

  async function addTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('student_tasks')
      .insert({ student_id: student.id, title: newTitle.trim(), due_date: newDue || null })
      .select()
      .single()
    if (data) setTasks(prev => [...prev, data])
    setNewTitle('')
    setNewDue('')
    setAdding(false)
    setSaving(false)
  }

  async function toggleTask(task) {
    const completed = !task.completed
    const completed_at = completed ? new Date().toISOString() : null
    const { data } = await supabase
      .from('student_tasks')
      .update({ completed, completed_at })
      .eq('id', task.id)
      .select()
      .single()
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  async function deleteTask(id) {
    await supabase.from('student_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const pending = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
        background: '#f5f0ff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem', color: '#7c3aed' }}>
          <ClipboardList size={16} />
          自分のタスク
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: '#7c3aed', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '5px 12px',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={13} /> タスクを追加
        </button>
      </div>

      {adding && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#faf8ff' }}>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="タスク名を入力..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', fontSize: '0.9rem',
              marginBottom: 8, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <CalendarDays size={13} />
              <input
                type="date"
                value={newDue}
                onChange={e => setNewDue(e.target.value)}
                style={{
                  border: '1px solid var(--border)', borderRadius: '6px',
                  padding: '4px 8px', fontSize: '0.82rem', color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => { setAdding(false); setNewTitle(''); setNewDue('') }} style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: '7px',
                padding: '5px 12px', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-muted)',
              }}>キャンセル</button>
              <button onClick={addTask} disabled={saving || !newTitle.trim()} style={{
                background: '#7c3aed', color: '#fff', border: 'none',
                borderRadius: '7px', padding: '5px 14px', fontSize: '0.82rem',
                fontWeight: 600, cursor: 'pointer', opacity: !newTitle.trim() ? 0.5 : 1,
              }}>
                {saving ? <Loader size={13} /> : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '8px 0' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader size={18} /></div>
        ) : tasks.length === 0 && !adding ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            タスクはまだありません
          </div>
        ) : (
          <>
            {pending.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
            {done.length > 0 && pending.length > 0 && (
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 18px' }} />
            )}
            {done.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 18px', transition: 'background 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <button
        onClick={() => onToggle(task)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: task.completed ? '#7c3aed' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
      >
        {task.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.9rem', fontWeight: 500,
          color: task.completed ? 'var(--text-muted)' : 'var(--text)',
          textDecoration: task.completed ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.title}</div>
        {task.due_date && (
          <div style={{ fontSize: '0.75rem', color: task.completed ? 'var(--text-muted)' : (new Date(task.due_date) < new Date() ? '#e53e3e' : 'var(--text-muted)'), display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <CalendarDays size={11} />
            {task.due_date}
            {task.completed && task.completed_at && (
              <span style={{ marginLeft: 6 }}>— 完了: {new Date(task.completed_at).toLocaleDateString('ja-JP')}</span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => onDelete(task.id)}
        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0, borderRadius: 6 }}
        onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function StudentHomeworkCard({ hw, student, photos, scopeNote, submission, onAddPhoto, onRemovePhoto, onNoteChange, onSubmit }) {
  const [note, setNote] = useState(scopeNote?.note || '')
  const [uploading, setUploading] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitPhase, setSubmitPhase] = useState(null)
  const [aiError, setAiError] = useState(null)
  const fileInputRef = useRef(null)
  const color = SUBJECT_COLORS[hw.subject] || '#5a5a5a'
  const isOverdue = new Date(hw.deadline) < new Date()

  useEffect(() => {
    setNote(scopeNote?.note || '')
  }, [scopeNote])

  async function saveNote(value) {
    setSavingNote(true)
    await supabase.from('student_scope_notes').upsert({
      homework_id: hw.id,
      student_id: student.id,
      note: value,
    }, { onConflict: 'homework_id,student_id' })
    onNoteChange(value)
    setSavingNote(false)
  }

  async function handleFiles(files) {
    if (!files.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${hw.id}/${student.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('homework-photos')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (!uploadErr) {
        const { data } = await supabase.from('photo_submissions').insert({
          homework_id: hw.id,
          student_id: student.id,
          file_path: path,
          file_name: file.name,
        }).select().single()
        if (data) onAddPhoto(data)
      }
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deletePhoto(photo) {
    await supabase.storage.from('homework-photos').remove([photo.file_path])
    await supabase.from('photo_submissions').delete().eq('id', photo.id)
    onRemovePhoto(photo.id)
  }

  async function doSubmit() {
    setSubmitting(true)
    const now = new Date().toISOString()

    let aiStatus = 'unchecked'
    let aiFeedback = null
    let needsResubmit = false

    setAiError(null)
    if (photos.length > 0 && getApiKeys().gemini) {
      setSubmitPhase('ai')
      try {
        const urls = photos.map(p => photoUrl(p.file_path))
        const aiResult = await analyzeHomeworkPhotos(urls, hw.subject, hw.title)
        if (aiResult.pass) {
          aiStatus = 'pass'
        } else {
          aiStatus = 'fail'
          aiFeedback = aiResult.feedback || '自学メモや途中式が不足しています。写真を撮り直して再提出してください。'
          needsResubmit = true
        }
      } catch (e) {
        console.warn('AI check failed:', e.message)
        setAiError(e.message)
      }
    }

    setSubmitPhase('saving')

    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('homework_id', hw.id)
      .eq('student_id', student.id)
      .maybeSingle()

    // AI カラムあり版
    const fullData = needsResubmit
      ? { submitted: false, submitted_at: null, ai_status: aiStatus, ai_feedback: aiFeedback, needs_resubmit: true }
      : { submitted: true, submitted_at: now, ai_status: aiStatus, ai_feedback: null, needs_resubmit: false }

    // AI カラムなし版（マイグレーション未実行時のフォールバック）
    const baseData = needsResubmit
      ? { submitted: false, submitted_at: null }
      : { submitted: true, submitted_at: now }

    async function upsert(data) {
      if (existing) {
        return supabase.from('submissions').update(data).eq('id', existing.id).select().single()
      } else {
        return supabase.from('submissions').insert({ homework_id: hw.id, student_id: student.id, ...data }).select().single()
      }
    }

    let { data: result, error } = await upsert(fullData)
    if (error) {
      // AI カラムが未追加の場合はベースデータで再試行
      console.warn('AI columns not found, falling back:', error.message)
      const { data: fallback } = await upsert(baseData)
      result = fallback
    }

    if (result) onSubmit(result)
    setSubmitting(false)
    setSubmitPhase(null)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px' }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <Badge color={color}>{hw.subject}</Badge>
          {isOverdue && <Badge color="#c0392b">期限超過</Badge>}
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{hw.title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>締め切り：{hw.deadline}</div>

        {/* 課題範囲（先生設定） */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileText size={12} />先生からの課題範囲
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: hw.scope ? 'var(--accent-light)' : 'var(--surface2)',
            borderLeft: hw.scope ? '3px solid var(--accent)' : '3px solid var(--border)',
            fontSize: '0.88rem', whiteSpace: 'pre-wrap',
            color: hw.scope ? 'inherit' : 'var(--text-muted)',
          }}>
            {hw.scope || '先生からの課題範囲はまだ設定されていません'}
          </div>
        </div>

        {/* 自分のメモ */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Image size={12} />自分のメモ
            </span>
            {savingNote && <span style={{ fontSize: '0.68rem', color: 'var(--accent)' }}>保存中…</span>}
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontSize: '0.88rem' }}
            placeholder="自分用のメモを書いておこう（自動保存）"
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={e => saveNote(e.target.value)}
          />
        </div>

        {/* 写真提出 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Camera size={12} />提出写真（{photos.length}枚）
            </div>
            <Btn small onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader size={13} /> : <Camera size={13} />}
              {uploading ? 'アップロード中...' : '写真を追加'}
            </Btn>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {photos.length > 0 ? (
            <PhotoGrid photos={photos} onDelete={submission?.submitted ? undefined : deletePhoto} />
          ) : (
            <div style={{
              border: '2px dashed var(--border)', borderRadius: 8,
              padding: '20px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.82rem',
              cursor: 'pointer',
            }} onClick={() => fileInputRef.current?.click()}>
              <Camera size={20} style={{ marginBottom: 6, opacity: 0.4 }} />
              <div>タップして写真を追加</div>
              <div style={{ fontSize: '0.72rem', marginTop: 4, opacity: 0.7 }}>複数枚まとめて選択できます</div>
            </div>
          )}
        </div>

        {/* 提出ボタン */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {submission?.submitted && !submission?.needs_resubmit ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 10,
              background: 'var(--accent-light)', border: '1px solid var(--accent)',
            }}>
              <CheckCircle size={22} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  提出済み {submission.ai_status === 'pass' && <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>✓ AI確認済</span>}
                </div>
                {submission.submitted_at && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {fmtDate(submission.submitted_at)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {submission?.needs_resubmit && submission?.ai_feedback && (
                <div style={{
                  display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
                  background: '#fff8f0', border: '1px solid #dd6b20', marginBottom: 12,
                }}>
                  <AlertCircle size={18} color="#dd6b20" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dd6b20', marginBottom: 3 }}>
                      再提出が必要です
                    </div>
                    <div style={{ fontSize: '0.83rem', color: '#7b341e', lineHeight: 1.6 }}>
                      {submission.ai_feedback}
                    </div>
                  </div>
                </div>
              )}
              {aiError && (
                <div style={{
                  display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                  background: '#fffbeb', border: '1px solid #f6ad55', marginBottom: 10,
                  fontSize: '0.8rem', color: '#7b4e00',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} color="#dd6b20" />
                  <span>AIチェックをスキップしました: {aiError}</span>
                </div>
              )}
              {photos.length === 0 && !submission?.needs_resubmit && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  写真を添付してから提出ボタンを押してください
                </div>
              )}
              <Btn onClick={doSubmit} disabled={submitting}>
                {submitting ? <Loader size={15} /> : <CheckCircle size={15} />}
                {submitting
                  ? submitPhase === 'ai' ? 'AI確認中...' : '提出中...'
                  : submission?.needs_resubmit ? '再提出する' : '提出する'
                }
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 先生ログインモーダル ──────────────────────────

function TeacherLoginModal({ onSuccess, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const correct = import.meta.env.VITE_TEACHER_PASSWORD
    if (!correct) {
      setError('パスワードが設定されていません。Vercelの環境変数を確認してください。')
      return
    }
    if (password === correct) {
      onSuccess()
    } else {
      setError('パスワードが違います')
      setPassword('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px', padding: '32px 28px',
        width: '100%', maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: '#2d5a2718', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#2d5a27',
          }}><Key size={20} /></div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>先生ログイン</div>
        </div>
        <form onSubmit={handleSubmit}>
          <Field label="パスワード">
            <input
              type="password"
              style={inputStyle}
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="パスワードを入力"
              autoFocus
            />
          </Field>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e53e3e', fontSize: '0.83rem', marginBottom: 12 }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={onClose} outline>キャンセル</Btn>
            <button type="submit" style={{
              flex: 1, padding: '9px 18px', border: 'none', borderRadius: '10px',
              background: '#2d5a27', color: '#fff', fontWeight: 700,
              fontSize: '0.88rem', cursor: 'pointer',
            }}>ログイン</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── メインアプリ ────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('student')
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [teacherLoginOpen, setTeacherLoginOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {teacherLoginOpen && (
        <TeacherLoginModal
          onSuccess={() => { setTeacherLoginOpen(false); setMode('teacher') }}
          onClose={() => setTeacherLoginOpen(false)}
        />
      )}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 10 }}>
          <BookOpen size={20} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>宿題提出管理</span>
          {mode === 'teacher' && (
            <Badge color="#2d5a27">先生</Badge>
          )}
          {mode === 'teacher' && selectedSchool && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedSchool.name}</span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {mode === 'teacher' && (
            <button onClick={() => { setMode('student'); setSelectedSchool(null) }} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '5px 12px', fontSize: '0.78rem', color: 'var(--text-muted)',
              fontWeight: 600, cursor: 'pointer',
            }}>
              生徒画面へ
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>
        {mode === 'teacher' ? (
          selectedSchool ? (
            <SchoolDetail school={selectedSchool} onBack={() => setSelectedSchool(null)} />
          ) : (
            <SchoolList onSelect={setSelectedSchool} />
          )
        ) : (
          <StudentMode onTeacher={() => setTeacherLoginOpen(true)} />
        )}
      </main>
    </div>
  )
}
