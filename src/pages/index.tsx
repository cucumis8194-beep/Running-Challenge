import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.css'

const RoomDashboard = dynamic(() => import('@/components/RoomDashboard'), { ssr: false })

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

type SavedRoom = {
  roomId: string
  roomName: string
  code: string
  nickname: string
  goalKm: number
  penalty: string
}

export default function Home() {
  const [step, setStep] = useState<'list' | 'join' | 'create' | 'room'>('list')
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<SavedRoom | null>(null)
  const [newRoom, setNewRoom] = useState({ name: '', goalKm: '5', penalty: '아이스아메리카노 1잔' })

  useEffect(() => {
    try {
      const saved = localStorage.getItem('running_rooms')
      if (saved) setSavedRooms(JSON.parse(saved))
    } catch {}
  }, [])

  function saveRoom(room: SavedRoom) {
    const updated = savedRooms.filter(r => !(r.roomId === room.roomId && r.nickname === room.nickname))
    updated.unshift(room)
    setSavedRooms(updated)
    localStorage.setItem('running_rooms', JSON.stringify(updated))
  }

  function removeRoom(roomId: string, nickname: string) {
    const updated = savedRooms.filter(r => !(r.roomId === roomId && r.nickname === nickname))
    setSavedRooms(updated)
    localStorage.setItem('running_rooms', JSON.stringify(updated))
  }

  async function handleJoin() {
    if (!nickname.trim()) { setError('닉네임을 입력하세요.'); return }
    if (!code.trim()) { setError('방 코드를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: room, error: re } = await supabase
        .from('rooms').select('*').eq('code', code.toUpperCase()).single()
      if (re || !room) { setError('방을 찾을 수 없어요. 코드를 확인해주세요.'); setLoading(false); return }
      await supabase.from('members').upsert(
        { room_id: room.id, nickname: nickname.trim() },
        { onConflict: 'room_id,nickname' }
      )
      const saved: SavedRoom = { roomId: room.id, nickname: nickname.trim(), goalKm: room.goal_km, penalty: room.penalty, roomName: room.name, code: room.code }
      saveRoom(saved)
      setActiveRoom(saved)
      setStep('room')
    } catch { setError('연결 오류. 다시 시도해주세요.') }
    setLoading(false)
  }

  async function handleCreate() {
    if (!nickname.trim()) { setError('닉네임을 입력하세요.'); return }
    if (!newRoom.name.trim()) { setError('방 이름을 입력하세요.'); return }
    const goalKm = parseFloat(newRoom.goalKm)
    if (isNaN(goalKm) || goalKm <= 0) { setError('목표 거리를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const roomCode = generateCode()
      const { data: room, error: re } = await supabase.from('rooms').insert({
        code: roomCode, name: newRoom.name.trim(), goal_km: goalKm,
        penalty: newRoom.penalty.trim() || '아이스아메리카노 1잔', created_by: nickname.trim()
      }).select().single()
      if (re || !room) throw re
      await supabase.from('members').insert({ room_id: room.id, nickname: nickname.trim() })
      const saved: SavedRoom = { roomId: room.id, nickname: nickname.trim(), goalKm: room.goal_km, penalty: room.penalty, roomName: room.name, code: room.code }
      saveRoom(saved)
      setActiveRoom(saved)
      setStep('room')
    } catch { setError('방 생성 실패. 다시 시도해주세요.') }
    setLoading(false)
  }

  if (step === 'room' && activeRoom) {
    return <RoomDashboard {...activeRoom} onLeave={() => { setActiveRoom(null); setStep('list') }} />
  }

  // 저장된 방 목록 화면
  if (step === 'list') {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>🏃 러닝 챌린지</h1>
            <p className={styles.subtitle}>친구들과 함께 주간 달리기 미션</p>
          </div>

          {savedRooms.length > 0 && (
            <div className={styles.savedSection}>
              <div className={styles.sectionLabel}>참여 중인 챌린지</div>
              {savedRooms.map((r, i) => (
                <div key={i} className={styles.savedCard} onClick={() => { setActiveRoom(r); setStep('room') }}>
                  <div className={styles.savedInfo}>
                    <div className={styles.savedName}>{r.roomName}</div>
                    <div className={styles.savedMeta}>{r.nickname} · 목표 {r.goalKm}km · 코드 {r.code}</div>
                  </div>
                  <div className={styles.savedActions}>
                    <span className={styles.enterBtn}>입장 →</span>
                    <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeRoom(r.roomId, r.nickname) }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.newSection}>
            <button className={styles.btnOutline} onClick={() => { setStep('join'); setError('') }}>기존 방 참가하기</button>
            <button className={styles.btnPrimary} onClick={() => { setStep('create'); setError('') }}>새 방 만들기</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>🏃 러닝 챌린지</h1>
        </div>
        <button className={styles.backBtn} onClick={() => { setStep('list'); setError('') }}>← 뒤로</button>

        <div className={styles.card}>
          <div className={styles.cardTitle}>{step === 'join' ? '방 참가하기' : '새 방 만들기'}</div>

          <div className={styles.field}>
            <label className={styles.label}>내 닉네임</label>
            <input className={styles.input} placeholder="홍길동" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={12} />
          </div>

          {step === 'join' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>방 코드</label>
                <input className={styles.input} placeholder="예: ABC123" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleJoin} disabled={loading}>
                {loading ? '참가 중...' : '참가하기'}
              </button>
            </>
          )}

          {step === 'create' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>방 이름</label>
                <input className={styles.input} placeholder="예: 갱년기 극복런" value={newRoom.name}
                  onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} maxLength={30} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>주간 목표 거리 (km)</label>
                <input className={styles.input} type="number" placeholder="5" min="0.5" max="200" step="0.5"
                  value={newRoom.goalKm} onChange={e => setNewRoom(p => ({ ...p, goalKm: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>벌칙</label>
                <input className={styles.input} placeholder="아이스아메리카노 1잔" value={newRoom.penalty}
                  onChange={e => setNewRoom(p => ({ ...p, penalty: e.target.value }))} maxLength={50} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={loading}>
                {loading ? '생성 중...' : '방 만들기'}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
