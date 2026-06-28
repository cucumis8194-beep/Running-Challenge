import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.css'

const RoomDashboard = dynamic(() => import('@/components/RoomDashboard'), { ssr: false })

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

type SessionUser = {
  id: string
  nickname: string
}

type JoinedRoom = {
  roomId: string
  roomName: string
  code: string
  goalKm: number
  penalty: string
  displayName: string
  createdBy: string
  adminPassword: string
}

export default function Home() {
  const [step, setStep] = useState<'list' | 'login' | 'signup' | 'join-room' | 'create-room' | 'room'>('list')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<JoinedRoom | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ nickname: '', password: '' })
  const [signupForm, setSignupForm] = useState({ nickname: '', password: '', confirm: '' })
  const [joinRoomForm, setJoinRoomForm] = useState({ code: '', displayName: '' })
  const [createRoomForm, setCreateRoomForm] = useState({ name: '', goalKm: '5', penalty: '아이스아메리카노 1잔', adminPassword: '' })

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('rc_user')
      const savedRooms = localStorage.getItem('rc_rooms')
      if (savedUser) setUser(JSON.parse(savedUser))
      if (savedRooms) setJoinedRooms(JSON.parse(savedRooms))
    } catch {}
  }, [])

  function saveSession(u: SessionUser, rooms: JoinedRoom[]) {
    localStorage.setItem('rc_user', JSON.stringify(u))
    localStorage.setItem('rc_rooms', JSON.stringify(rooms))
  }

  function addRoom(room: JoinedRoom) {
    const updated = [room, ...joinedRooms.filter(r => r.roomId !== room.roomId)]
    setJoinedRooms(updated)
    if (user) saveSession(user, updated)
  }

  function removeRoom(roomId: string) {
    const updated = joinedRooms.filter(r => r.roomId !== roomId)
    setJoinedRooms(updated)
    if (user) saveSession(user, updated)
  }

  async function handleLogin() {
    if (!loginForm.nickname.trim() || !loginForm.password.trim()) { setError('닉네임과 비밀번호를 입력하세요.'); return }
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error: e } = await supabase.from('users').select('*')
        .eq('nickname', loginForm.nickname.trim())
        .eq('password', loginForm.password.trim())
        .single()
      if (e || !data) { setError('닉네임 또는 비밀번호가 틀렸어요.'); setLoading(false); return }
      const u = { id: data.id, nickname: data.nickname }
      setUser(u)
      const savedRooms = joinedRooms
      saveSession(u, savedRooms)
      setStep('list')
    } catch { setError('연결 오류. 다시 시도해주세요.') }
    setLoading(false)
  }

  async function handleSignup() {
    if (!signupForm.nickname.trim()) { setError('닉네임을 입력하세요.'); return }
    if (!signupForm.password.trim()) { setError('비밀번호를 입력하세요.'); return }
    if (signupForm.password !== signupForm.confirm) { setError('비밀번호가 일치하지 않아요.'); return }
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: existing } = await supabase.from('users').select('id').eq('nickname', signupForm.nickname.trim()).single()
      if (existing) { setError('이미 사용 중인 닉네임이에요.'); setLoading(false); return }
      const { data, error: e } = await supabase.from('users').insert({
        nickname: signupForm.nickname.trim(), password: signupForm.password.trim()
      }).select().single()
      if (e || !data) throw e
      const u = { id: data.id, nickname: data.nickname }
      setUser(u)
      saveSession(u, [])
      setStep('list')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof (err as {message: string}).message === 'string' && (err as {message: string}).message.includes('unique')) {
        setError('이미 사용 중인 닉네임이에요.')
      } else {
        setError('가입 실패. 다시 시도해주세요.')
      }
    }
    setLoading(false)
  }

  async function handleJoinRoom() {
    if (!joinRoomForm.code.trim()) { setError('방 코드를 입력하세요.'); return }
    if (!joinRoomForm.displayName.trim()) { setError('이 방에서 쓸 닉네임을 입력하세요.'); return }
    if (!user) return
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: room, error: re } = await supabase.from('rooms').select('*').eq('code', joinRoomForm.code.toUpperCase()).single()
      if (re || !room) { setError('방을 찾을 수 없어요. 코드를 확인해주세요.'); setLoading(false); return }
      const { data: nameCheck } = await supabase.from('room_members').select('id')
        .eq('room_id', room.id).eq('display_name', joinRoomForm.displayName.trim()).single()
      if (nameCheck) { setError('이미 사용 중인 닉네임이에요. 다른 닉네임을 써주세요.'); setLoading(false); return }
      await supabase.from('room_members').upsert(
        { room_id: room.id, user_id: user.id, display_name: joinRoomForm.displayName.trim() },
        { onConflict: 'room_id,user_id' }
      )
      const joined: JoinedRoom = {
        roomId: room.id, roomName: room.name, code: room.code,
        goalKm: room.goal_km, penalty: room.penalty,
        displayName: joinRoomForm.displayName.trim(),
        createdBy: room.created_by, adminPassword: room.admin_password
      }
      addRoom(joined)
      setActiveRoom(joined)
      setStep('room')
    } catch { setError('연결 오류. 다시 시도해주세요.') }
    setLoading(false)
  }

  async function handleCreateRoom() {
    if (!createRoomForm.name.trim()) { setError('방 이름을 입력하세요.'); return }
    if (!createRoomForm.adminPassword.trim()) { setError('방장 비밀번호를 입력하세요.'); return }
    const goalKm = parseFloat(createRoomForm.goalKm)
    if (isNaN(goalKm) || goalKm <= 0) { setError('목표 거리를 입력하세요.'); return }
    if (!user) return
    setLoading(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const roomCode = generateCode()
      const { data: room, error: re } = await supabase.from('rooms').insert({
        code: roomCode, name: createRoomForm.name.trim(), goal_km: goalKm,
        penalty: createRoomForm.penalty.trim() || '아이스아메리카노 1잔',
        created_by: user.id, admin_password: createRoomForm.adminPassword.trim()
      }).select().single()
      if (re || !room) throw re
      await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id, display_name: user.nickname })
      await supabase.from('goal_history').insert({ room_id: room.id, goal_km: goalKm, applied_from: new Date().toISOString().slice(0, 10) })
      const joined: JoinedRoom = {
        roomId: room.id, roomName: room.name, code: room.code,
        goalKm: room.goal_km, penalty: room.penalty,
        displayName: user.nickname, createdBy: room.created_by, adminPassword: room.admin_password
      }
      addRoom(joined)
      setActiveRoom(joined)
      setStep('room')
    } catch { setError('방 생성 실패. 다시 시도해주세요.') }
    setLoading(false)
  }

  function handleRoomUpdate(updated: Partial<JoinedRoom>) {
    if (!activeRoom) return
    const newRoom = { ...activeRoom, ...updated }
    setActiveRoom(newRoom)
    const updatedRooms = joinedRooms.map(r => r.roomId === newRoom.roomId ? newRoom : r)
    setJoinedRooms(updatedRooms)
    if (user) saveSession(user, updatedRooms)
  }

  function handleLogout() {
    localStorage.removeItem('rc_user')
    localStorage.removeItem('rc_rooms')
    setUser(null)
    setJoinedRooms([])
    setStep('list')
  }

  if (step === 'room' && activeRoom && user) {
    return <RoomDashboard
      {...activeRoom}
      userId={user.id}
      onLeave={() => { setActiveRoom(null); setStep('list') }}
      onRoomUpdate={handleRoomUpdate}
    />
  }

  if (step === 'list') {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>🏃 러닝 챌린지</h1>
            <p className={styles.subtitle}>친구들과 함께 주간 달리기 미션</p>
          </div>

          {!user ? (
            <div className={styles.newSection}>
              <button className={styles.btnPrimary} onClick={() => { setStep('login'); setError('') }}>로그인</button>
              <button className={styles.btnOutline} onClick={() => { setStep('signup'); setError('') }}>처음 사용해요 (계정 만들기)</button>
            </div>
          ) : (
            <>
              <div className={styles.userBar}>
                <span className={styles.userNick}>👤 {user.nickname}</span>
                <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
              </div>

              {joinedRooms.length > 0 && (
                <div className={styles.savedSection}>
                  <div className={styles.sectionLabel}>참여 중인 챌린지</div>
                  {joinedRooms.map((r, i) => (
                    <div key={i} className={styles.savedCard} onClick={() => { setActiveRoom(r); setStep('room') }}>
                      <div className={styles.savedInfo}>
                        <div className={styles.savedName}>{r.roomName}</div>
                        <div className={styles.savedMeta}>{r.displayName} · 목표 {r.goalKm}km · 코드 {r.code}</div>
                      </div>
                      <div className={styles.savedActions}>
                        <span className={styles.enterBtn}>입장 →</span>
                        <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeRoom(r.roomId) }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.newSection}>
                <button className={styles.btnOutline} onClick={() => { setStep('join-room'); setError(''); setJoinRoomForm({ code: '', displayName: user.nickname }) }}>방 참가하기</button>
                <button className={styles.btnPrimary} onClick={() => { setStep('create-room'); setError('') }}>새 방 만들기</button>
              </div>
            </>
          )}
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
          {step === 'login' && (
            <>
              <div className={styles.cardTitle}>로그인</div>
              <div className={styles.field}>
                <label className={styles.label}>닉네임</label>
                <input className={styles.input} placeholder="홍길동" value={loginForm.nickname}
                  onChange={e => setLoginForm(p => ({ ...p, nickname: e.target.value }))} maxLength={12} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>비밀번호</label>
                <input className={styles.input} type="password" placeholder="비밀번호" value={loginForm.password}
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleLogin} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
            </>
          )}

          {step === 'signup' && (
            <>
              <div className={styles.cardTitle}>계정 만들기</div>
              <div className={styles.field}>
                <label className={styles.label}>닉네임</label>
                <input className={styles.input} placeholder="홍길동" value={signupForm.nickname}
                  onChange={e => setSignupForm(p => ({ ...p, nickname: e.target.value }))} maxLength={12} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>비밀번호</label>
                <input className={styles.input} type="password" placeholder="비밀번호" value={signupForm.password}
                  onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>비밀번호 확인</label>
                <input className={styles.input} type="password" placeholder="비밀번호 다시 입력" value={signupForm.confirm}
                  onChange={e => setSignupForm(p => ({ ...p, confirm: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleSignup} disabled={loading}>{loading ? '가입 중...' : '계정 만들기'}</button>
            </>
          )}

          {step === 'join-room' && (
            <>
              <div className={styles.cardTitle}>방 참가하기</div>
              <div className={styles.field}>
                <label className={styles.label}>방 코드</label>
                <input className={styles.input} placeholder="예: ABC123" value={joinRoomForm.code}
                  onChange={e => setJoinRoomForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} maxLength={6} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>이 방에서 쓸 닉네임</label>
                <input className={styles.input} placeholder="홍길동" value={joinRoomForm.displayName}
                  onChange={e => setJoinRoomForm(p => ({ ...p, displayName: e.target.value }))} maxLength={12}
                  onKeyDown={e => e.key === 'Enter' && handleJoinRoom()} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleJoinRoom} disabled={loading}>{loading ? '참가 중...' : '참가하기'}</button>
            </>
          )}

          {step === 'create-room' && (
            <>
              <div className={styles.cardTitle}>새 방 만들기</div>
              <div className={styles.field}>
                <label className={styles.label}>방 이름</label>
                <input className={styles.input} placeholder="예: 갱년기 극복런" value={createRoomForm.name}
                  onChange={e => setCreateRoomForm(p => ({ ...p, name: e.target.value }))} maxLength={30} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>주간 목표 거리 (km)</label>
                <input className={styles.input} type="number" placeholder="5" min="0.5" max="200" step="0.5"
                  value={createRoomForm.goalKm} onChange={e => setCreateRoomForm(p => ({ ...p, goalKm: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>벌칙</label>
                <input className={styles.input} placeholder="아이스아메리카노 1잔" value={createRoomForm.penalty}
                  onChange={e => setCreateRoomForm(p => ({ ...p, penalty: e.target.value }))} maxLength={50} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>방장 비밀번호 (방 설정 변경 시 필요)</label>
                <input className={styles.input} type="password" placeholder="숫자나 문자 자유롭게" value={createRoomForm.adminPassword}
                  onChange={e => setCreateRoomForm(p => ({ ...p, adminPassword: e.target.value }))} maxLength={20} />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btnPrimary} onClick={handleCreateRoom} disabled={loading}>{loading ? '생성 중...' : '방 만들기'}</button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
