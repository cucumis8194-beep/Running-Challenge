'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import RoomDashboard from '@/components/RoomDashboard'
import styles from './page.module.css'

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function Home() {
  const [step, setStep] = useState<'join' | 'create' | 'room'>('join')
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [roomData, setRoomData] = useState<{ roomId: string; nickname: string; goalKm: number; penalty: string; roomName: string; code: string } | null>(null)

  // 방 만들기 폼 상태
  const [newRoom, setNewRoom] = useState({ name: '', goalKm: '5', penalty: '아이스아메리카노 1잔' })

  async function handleJoin() {
    if (!nickname.trim()) { setError('닉네임을 입력하세요.'); return }
    if (!code.trim()) { setError('방 코드를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const { data: room, error: re } = await supabase
        .from('rooms').select('*').eq('code', code.toUpperCase()).single()
      if (re || !room) { setError('방을 찾을 수 없어요. 코드를 확인해주세요.'); setLoading(false); return }

      await supabase.from('members').upsert(
        { room_id: room.id, nickname: nickname.trim() },
        { onConflict: 'room_id,nickname' }
      )
      setRoomData({ roomId: room.id, nickname: nickname.trim(), goalKm: room.goal_km, penalty: room.penalty, roomName: room.name, code: room.code })
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
      const roomCode = generateCode()
      const { data: room, error: re } = await supabase.from('rooms').insert({
        code: roomCode,
        name: newRoom.name.trim(),
        goal_km: goalKm,
        penalty: newRoom.penalty.trim() || '아이스아메리카노 1잔',
        created_by: nickname.trim()
      }).select().single()
      if (re || !room) throw re

      await supabase.from('members').insert({ room_id: room.id, nickname: nickname.trim() })
      setRoomData({ roomId: room.id, nickname: nickname.trim(), goalKm: room.goal_km, penalty: room.penalty, roomName: room.name, code: room.code })
      setStep('room')
    } catch { setError('방 생성 실패. 다시 시도해주세요.') }
    setLoading(false)
  }

  if (step === 'room' && roomData) {
    return <RoomDashboard {...roomData} onLeave={() => { setStep('join'); setRoomData(null); setNickname(''); setCode('') }} />
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>🏃 러닝 챌린지</h1>
          <p className={styles.subtitle}>친구들과 함께 주간 달리기 미션</p>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${step === 'join' ? styles.tabActive : ''}`} onClick={() => { setStep('join'); setError('') }}>방 참가</button>
          <button className={`${styles.tab} ${step === 'create' ? styles.tabActive : ''}`} onClick={() => { setStep('create'); setError('') }}>방 만들기</button>
        </div>

        <div className={styles.card}>
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
                <input className={styles.input} placeholder="예: 팀 러닝 챌린지" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} maxLength={30} />
              </div>
              <div className={styles.row}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>주간 목표 거리 (km)</label>
                  <input className={styles.input} type="number" placeholder="5" min="0.5" max="200" step="0.5"
                    value={newRoom.goalKm} onChange={e => setNewRoom(p => ({ ...p, goalKm: e.target.value }))} />
                </div>
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
