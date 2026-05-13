import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import {
  BookOpen, Users, ClipboardList, Plus, Trash2,
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  School, ArrowLeft, Loader
} from 'lucide-react'

const SUBJECTS = ['数学', '国語', '英語', '理科', '社会', '音楽', '美術', '体育', 'その他']
const SUBJECT_COLORS = {
  '数学': '#2d5a27', '国語': '#8b3a3a', '英語': '#1a4a6b',
  '理科': '#4a6b1a', '社会': '#6b4a1a', '音楽': '#6b1a5a',
  '美術': '#1a5a6b', '体育': '#5a6b1a', 'その他': '#5a5a5a',
}

// ── UI部品 ──────────────────────────────────────

function Btn({ onClick, children, color = 'accent', small, danger, outline }) {
  const bg = danger ? 'var(--danger)' : outline ? 'transparent' : `var(--${color})`
  const border = outline ? '1px solid var(--border)' : danger ? 'none' : 'none'
  const col = outline ? 'var(--text-muted)' : '#fff'
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '6px 12px' : '9px 18px',
      border, borderRadius: '10px', background: bg, color: col,
      fontWeight: 700, fontSize: small ? '0.8rem' : '0.88rem',
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
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
}

// ── 校舎一覧画面 ────────────────────────────────

function SchoolList({ onSelect }) {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')

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
    setName(''); setShowAdd(false)
    fetchSchools()
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
          <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
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
              borderRadius: '14px', padding: '20px',
              cursor: 'pointer', transition: 'box-shadow 0.2s',
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
                <button onClick={e => { e.stopPropagation(); deleteSchool(s.id) }} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                ><Trash2 size={15} /></button>
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
    </div>
  )
}

// ── 校舎詳細画面 ────────────────────────────────

function SchoolDetail({ school, onBack }) {
  const [tab, setTab] = useState('homework')
  const [students, setStudents] = useState([])
  const [homework, setHomework] = useState([])
  const [submissions, setSubmissions] = useState([])
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
    setStudents(st || [])
    setHomework(hw || [])
    setSubmissions(sub || [])
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

  async function addHomework(form) {
    const { data: hw } = await supabase.from('homework').insert({
      title: form.title, subject: form.subject,
      deadline: form.deadline, school_id: school.id
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
    if (existing) {
      await supabase.from('submissions').update({ submitted: !existing.submitted }).eq('id', existing.id)
    } else {
      await supabase.from('submissions').insert({ homework_id: hwId, student_id: studentId, submitted: true })
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
      {/* 戻るボタン */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontWeight: 600, fontSize: '0.88rem', marginBottom: 20, padding: 0,
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

      {/* 統計 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<ClipboardList size={20} />} label="宿題数" value={homework.length} />
        <StatCard icon={<Users size={20} />} label="生徒数" value={students.length} />
        <StatCard icon={<CheckCircle size={20} />} label="全体提出率" value={`${overallRate}%`} />
        <StatCard icon={<XCircle size={20} />} label="未提出ありの生徒" value={notSubmittedStudents.length} sub="いずれかの宿題で未提出" />
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[
          { key: 'homework', label: '宿題一覧', icon: <ClipboardList size={15} /> },
          { key: 'students', label: '生徒管理', icon: <Users size={15} /> },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', border: 'none', borderRadius: '8px',
            background: tab === key ? 'var(--accent)' : 'transparent',
            color: tab === key ? '#fff' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>{icon}{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : tab === 'homework' ? (
        <HomeworkTab
          homework={homework} students={students} submissions={submissions}
          onAdd={addHomework} onDelete={deleteHomework} onToggle={toggleSubmission}
          showAdd={showAddHW} setShowAdd={setShowAddHW}
        />
      ) : (
        <StudentsTab
          students={students} homework={homework} submissions={submissions}
          onAdd={addStudent} onDelete={deleteStudent}
          showAdd={showAddSt} setShowAdd={setShowAddSt}
        />
      )}
    </div>
  )
}

// ── 宿題タブ ─────────────────────────────────────

function HomeworkTab({ homework, students, submissions, onAdd, onDelete, onToggle, showAdd, setShowAdd }) {
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
              fontSize: '0.8rem', fontWeight: 600,
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
              onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}

      {showAdd && <AddHomeworkModal onAdd={onAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function HomeworkCard({ hw, students, submissions, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  const color = SUBJECT_COLORS[hw.subject] || '#5a5a5a'
  const isOverdue = new Date(hw.deadline) < new Date()

  const submitted = students.filter(s => {
    const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
    return sub?.submitted
  })
  const notSubmitted = students.filter(s => {
    const sub = submissions.find(sb => sb.homework_id === hw.id && sb.student_id === s.id)
    return !sub?.submitted
  })
  const rate = students.length > 0 ? Math.round((submitted.length / students.length) * 100) : 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <Badge color={color}>{hw.subject}</Badge>
              {isOverdue && <Badge color="#c0392b">期限超過</Badge>}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{hw.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>締め切り：{hw.deadline}</div>
          </div>
          <button onClick={() => onDelete(hw.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          ><Trash2 size={16} /></button>
        </div>
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

      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 20px', background: 'var(--surface2)',
        border: 'none', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600,
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
                    color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500,
                  }} title="クリックで提出済みにする">{s.name}</button>
                ))}
              </div>
            </div>
          )}
          {submitted.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>✓ 提出済み ({submitted.length}人)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {submitted.map(s => (
                  <button key={s.id} onClick={() => onToggle(hw.id, s.id)} style={{
                    padding: '5px 12px', borderRadius: '999px',
                    border: '1px solid var(--accent)', background: 'var(--accent-light)',
                    color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 500,
                  }} title="クリックで未提出に戻す">{s.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddHomeworkModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ title: '', subject: '数学', deadline: '' })
  const handle = () => {
    if (!form.title || !form.deadline) return alert('タイトルと締め切りを入力してください')
    onAdd(form); onClose()
  }
  return (
    <Modal title="宿題を追加" onClose={onClose}>
      <Field label="宿題名">
        <input style={inputStyle} placeholder="例：数学プリント②" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
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
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn outline onClick={onClose}>キャンセル</Btn>
        <Btn onClick={handle}>追加する</Btn>
      </div>
    </Modal>
  )
}

// ── 生徒タブ ─────────────────────────────────────

function StudentsTab({ students, homework, submissions, onAdd, onDelete, showAdd, setShowAdd }) {
  const [name, setName] = useState('')

  const handle = () => {
    if (!name.trim()) return
    onAdd(name.trim()); setName(''); setShowAdd(false)
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
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', padding: '14px 20px',
                borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--accent-light)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                }}>{s.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                  {notSubmitted.length > 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 2 }}>
                      未提出: {notSubmitted.map(h => h.title).join('、')}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: 2 }}>すべて提出済み ✓</div>
                  )}
                </div>
                <button onClick={() => onDelete(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                ><Trash2 size={15} /></button>
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
    </div>
  )
}

// ── メインアプリ ────────────────────────────────

export default function App() {
  const [selectedSchool, setSelectedSchool] = useState(null)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 10 }}>
          <BookOpen size={20} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>宿題提出管理</span>
          {selectedSchool && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedSchool.name}</span>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>
        {selectedSchool ? (
          <SchoolDetail school={selectedSchool} onBack={() => setSelectedSchool(null)} />
        ) : (
          <SchoolList onSelect={setSelectedSchool} />
        )}
      </main>
    </div>
  )
}
