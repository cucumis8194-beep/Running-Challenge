import { useEffect, useState, useCallback } from 'react'
import { supabase, RunLog } from '@/lib/supabase'
import { getWeekStart, getWeekDates, formatDateKr, formatWeekRange, getTodayKst } from '@/lib/dates'
import styles from './RoomDashboard.module.css'

type Props = {
  roomId: string
  roomName: string
  code: string
  goalKm: number
  penalty: string
  displayName: string
  userId: string
  createdBy: string
  adminPassword: string
  onLeave: () => void
  onRoomUpdate: (updated: { roomName?: string; goalKm?: number; penalty?: string }) => void
}

type MemberStat = { displayName: string; userId: string; totalKm: number; days: number; done: boolean }
type WeekHistory = { weekStart: string; totalKm: number; goalKm: number; done: boolean }

const DAY_KR = ['일','월','화','수','목','금','토']
const TODAY = getTodayKst()
const WEEK_START = getWeekStart()

export default function RoomDashboard({ roomId, roomName, code, goalKm, penalty, displayName, userId, createdBy, adminPassword, onLeave, onRoomUpdate }: Props) {
  const [logs, setLogs] = useState<RunLog[]>([])
  const [members, setMembers] = useState<{ userId: string; displayName: string }[]>([])
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [km, setKm] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'this' | 'history'>('this')
  const [weekHistory, setWeekHistory] = useState<WeekHistory[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [adminPwInput, setAdminPwInput] = useState('')
  const [adminVerified, setAdminVerified] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [settingsForm, setSettingsForm] = useState({ name: roomName, goalKm: String(goalKm), penalty })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const isAdmin = createdBy === userId

  const weekDates = getWeekDates(WEEK_START)
  const todayIdx = (new Date(TODAY + 'T00:00:00').getDay() + 6) % 7

  const loadData = useCallback(async () => {
    const [{ data: logData }, { data: memberData }] = await Promise.all([
      supabase.from('run_logs').select('*').eq('room_id', roomId),
      supabase.from('room_members').select('user_id, display_name').eq('room_id', roomId)
    ])
    if (logData) setLogs(logData as RunLog[])
    if (memberData) setMembers(memberData.map((m: {user_id: string; display_name: string}) => ({ userId: m.user_id, displayName: m.display_name })))

    if (logData) {
      const allWeeks = [...new Set(logData.map((l: RunLog) => l.week_start))].sort().reverse()
      const history: WeekHistory[] = allWeeks.map(ws => {
        const weekLogs = logData.filter((l: RunLog) => l.week_start === ws && l.user_id === userId)
        const total = weekLogs.reduce((s: number, l: RunLog) => s + Number(l.km), 0)
        return { weekStart: ws, totalKm: total, goalKm, done: total >= goalKm }
      })
      setWeekHistory(history)
    }
  }, [roomId, userId, goalKm])

  useEffect(() => {
    loadData()
    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'run_logs', filter: `room_id=eq.${roomId}` }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, loadData])

  function getMyKm() {
    return logs.filter(l => l.user_id === userId && l.week_start === WEEK_START).reduce((s, l) => s + Number(l.km), 0)
  }

  function getStats(): MemberStat[] {
    return members.map(m => {
      const myLogs = logs.filter(l => String(l.user_id) === m.userId && l.week_start === WEEK_START)
      const total = myLogs.reduce((s, l) => s + Number(l.km), 0)
      return { displayName: m.displayName, userId: m.userId, totalKm: total, days: new Set(myLogs.map(l => l.run_date)).size, done: total >= goalKm }
    }).sort((a, b) => b.totalKm - a.totalKm)
  }

  function getRank(stats: MemberStat[], idx: number): number {
    if (idx === 0) return 1
    return stats[idx].totalKm === stats[idx - 1].totalKm ? getRank(stats, idx - 1) : idx + 1
  }

  async function handleAdd() {
    setAddError('')
    const kmVal = parseFloat(km)
    if (isNaN(kmVal) || kmVal <= 0) { setAddError('거리를 입력하세요.'); return }
    setAdding(true)
    const { error } = await supabase.from('run_logs').insert({
      room_id: roomId, user_id: userId, run_date: selectedDate, km: kmVal, week_start: WEEK_START
    })
    if (error) setAddError('저장 실패. 다시 시도해주세요.')
    else { setKm(''); await loadData() }
    setAdding(false)
  }

  async function handleDeleteLog(id: string) {
    await supabase.from('run_logs').delete().eq('id', id)
    await loadData()
  }

  async function handleSaveSettings() {
    const newGoalKm = parseFloat(settingsForm.goalKm)
    if (!settingsForm.name.trim()) return
    if (isNaN(newGoalKm) || newGoalKm <= 0) return
    const { error } = await supabase.from('rooms').update({
      name: settingsForm.name.trim(), goal_km: newGoalKm, penalty: settingsForm.penalty.trim()
    }).eq('id', roomId)
    if (!error) {
      if (newGoalKm !== goalKm) {
        await supabase.from('goal_history').insert({ room_id: roomId, goal_km: newGoalKm, applied_from: TODAY })
      }
      onRoomUpdate({ roomName: settingsForm.name.trim(), goalKm: newGoalKm, penalty: settingsForm.penalty.trim() })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    }
  }

  function verifyAdmin() {
    if (adminPwInput === adminPassword) { setAdminVerified(true); setAdminError('') }
    else setAdminError('비밀번호가 틀렸어요.')
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const myKm = getMyKm()
  const pct = Math.min(100, (myKm / goalKm) * 100)
  const isDone = myKm >= goalKm
  const isLastDay = todayIdx === 6
  const daysLeft = 7 - todayIdx
  const stats = getStats()
  const myLogs = logs.filter(l => l.user_id === userId && l.week_start === WEEK_START).sort((a, b) => b.run_date.localeCompare(a.run_date))
  const successWeeks = weekHistory.filter(w => w.done).length
  const totalWeeks = weekHistory.length

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <div>
            <div className={styles.roomName}>{roomName}</div>
            <div className={styles.weekRange}>{formatWeekRange(WEEK_START)}</div>
          </div>
          <div className={styles.topRight}>
            <button className={styles.codeBtn} onClick={copyCode}>{copied ? '✓ 복사됨' : `코드: ${code}`}</button>
            {isAdmin && <button className={styles.settingsBtn} onClick={() => setShowSettings(!showSettings)}>⚙️</button>}
            <button className={styles.leaveBtn} onClick={onLeave}>나가기</button>
          </div>
        </div>

        {showSettings && (
          <div className={styles.settingsCard}>
            <div className={styles.settingsTitle}>방 설정 변경</div>
            {!adminVerified ? (
              <>
                <div className={styles.field}><label className={styles.label}>방장 비밀번호</label>
                  <input className={styles.input} type="password" placeholder="방장 비밀번호" value={adminPwInput}
                    onChange={e => setAdminPwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyAdmin()} />
                </div>
                {adminError && <p className={styles.addError}>{adminError}</p>}
                <button className={styles.addBtn} onClick={verifyAdmin}>확인</button>
              </>
            ) : (
              <>
                <div className={styles.field}><label className={styles.label}>방 이름</label>
                  <input className={styles.input} value={settingsForm.name} onChange={e => setSettingsForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className={styles.field}><label className={styles.label}>목표 거리 (km)</label>
                  <input className={styles.input} type="number" value={settingsForm.goalKm} onChange={e => setSettingsForm(p => ({ ...p, goalKm: e.target.value }))} />
                </div>
                <div className={styles.field}><label className={styles.label}>벌칙</label>
                  <input className={styles.input} value={settingsForm.penalty} onChange={e => setSettingsForm(p => ({ ...p, penalty: e.target.value }))} />
                </div>
                <button className={styles.addBtn} onClick={handleSaveSettings}>{settingsSaved ? '✓ 저장됨' : '저장'}</button>
              </>
            )}
          </div>
        )}

        <div className={styles.myCard}>
          <div className={styles.myTop}>
            <div><span className={styles.myKm}>{myKm.toFixed(1)}</span><span className={styles.myKmUnit}> / {goalKm}km</span></div>
            <span className={`${styles.badge} ${isDone ? styles.badgeDone : isLastDay && !isDone ? styles.badgeFail : styles.badgeProgress}`}>
              {isDone ? '✓ 달성!' : isLastDay ? '오늘 마감!' : `${daysLeft}일 남음`}
            </span>
          </div>
          <div className={styles.progBg}>
            <div className={`${styles.progFill} ${isDone ? styles.fillDone : isLastDay ? styles.fillDanger : styles.fillProgress}`} style={{ width: `${pct.toFixed(1)}%` }} />
          </div>
          {isDone
            ? <p className={styles.statusOk}>이번 주 미션 완료! {penalty} 안 사도 됩니다 🎉</p>
            : <p className={styles.statusWarn}>목표까지 {(goalKm - myKm).toFixed(1)}km 더 달려야 해요 → 못 채우면 <b>{penalty}</b></p>
          }
          {totalWeeks > 0 && (
            <p className={styles.statLine}>누적 달성율: {totalWeeks}주 중 {successWeeks}주 성공 ({Math.round(successWeeks/totalWeeks*100)}%)</p>
          )}
        </div>

        <div className={styles.daysGrid}>
          {weekDates.map((d, i) => {
            const dateStr = d.toISOString().slice(0,10)
            const dayKm = logs.filter(l => l.user_id === userId && l.run_date === dateStr).reduce((s, l) => s + Number(l.km), 0)
            const isToday = i === todayIdx
            return (
              <div key={i} className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${dayKm > 0 ? styles.dayCellRan : ''} ${i > todayIdx ? styles.dayCellFuture : ''}`}
                onClick={() => i <= todayIdx && setSelectedDate(dateStr)}>
                <div className={styles.dayName}>{['일','월','화','수','목','금','토'][d.getDay()]}</div>
                <div className={styles.dayKm}>{dayKm > 0 ? dayKm.toFixed(1) : i < todayIdx ? '—' : ''}</div>
              </div>
            )
          })}
        </div>

        <div className={styles.addCard}>
          <div className={styles.addLabel}>달린 거리 추가</div>
          <div className={styles.addRow}>
            <select className={styles.select} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
              {weekDates.slice(0, todayIdx+1).map((d, i) => {
                const ds = d.toISOString().slice(0,10)
                return <option key={i} value={ds}>{formatDateKr(ds)}</option>
              })}
            </select>
            <input className={styles.kmInput} type="number" placeholder="km" min="0.1" max="200" step="0.1"
              value={km} onChange={e => setKm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>{adding ? '...' : '추가'}</button>
          </div>
          {addError && <p className={styles.addError}>{addError}</p>}
        </div>

        {myLogs.length > 0 && (
          <div className={styles.logSection}>
            <div className={styles.logTitle}>내 기록 (이번 주)</div>
            {myLogs.map(log => (
              <div key={log.id} className={styles.logRow}>
                <span className={styles.logDate}>{formatDateKr(log.run_date)}</span>
                <div className={styles.logRight}>
                  <span className={styles.logKm}>{Number(log.km).toFixed(1)} km</span>
                  <button className={styles.delBtn} onClick={() => handleDeleteLog(log.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.tabBar}>
          <button className={`${styles.tabBtn} ${tab === 'this' ? styles.tabBtnActive : ''}`} onClick={() => setTab('this')}>이번 주 순위</button>
          <button className={`${styles.tabBtn} ${tab === 'history' ? styles.tabBtnActive : ''}`} onClick={() => setTab('history')}>지난 주 기록</button>
        </div>

        {tab === 'this' && (
          <div className={styles.leaderboard}>
            <div className={styles.lbTitle}>이번 주 순위 <span className={styles.lbMeta}>{stats.length}명</span></div>
            {stats.map((s, rank) => {
              const p = Math.min(100, (s.totalKm / goalKm) * 100)
              const isMe = s.userId === userId
              const displayRank = getRank(stats, rank)
              return (
                <div key={s.userId} className={`${styles.lbRow} ${isMe ? styles.lbRowMe : ''}`}>
                  <div className={styles.lbRank}>{displayRank}</div>
                  <div className={styles.lbInfo}>
                    <div className={styles.lbName}>
                      {s.displayName} {isMe && <span className={styles.meTag}>나</span>}
                      <span className={`${styles.lbBadge} ${s.done ? styles.lbBadgeDone : isLastDay ? styles.lbBadgeFail : styles.lbBadgeProgress}`}>
                        {s.done ? '완료' : isLastDay ? '실패' : '진행 중'}
                      </span>
                    </div>
                    <div className={styles.lbSub}>{s.totalKm.toFixed(1)}km · {s.days}일 기록</div>
                    <div className={styles.lbProgBg}>
                      <div className={`${styles.lbProgFill} ${s.done ? styles.fillDone : isLastDay ? styles.fillDanger : styles.fillProgress}`} style={{ width: `${p.toFixed(1)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'history' && (
          <div className={styles.leaderboard}>
            <div className={styles.lbTitle}>내 지난 주 기록</div>
            {weekHistory.length === 0 && <div className={styles.lbSub} style={{padding:'1rem 0'}}>아직 기록이 없어요.</div>}
            {weekHistory.map((w, i) => (
              <div key={i} className={styles.lbRow}>
                <div className={`${styles.lbRank} ${w.done ? styles.rankDone : styles.rankFail}`}>{w.done ? '✓' : '✗'}</div>
                <div className={styles.lbInfo}>
                  <div className={styles.lbName}>{formatWeekRange(w.weekStart)}</div>
                  <div className={styles.lbSub}>{w.totalKm.toFixed(1)}km / {w.goalKm}km</div>
                  <div className={styles.lbProgBg}>
                    <div className={`${styles.lbProgFill} ${w.done ? styles.fillDone : styles.fillDanger}`}
                      style={{ width: `${Math.min(100, w.totalKm/w.goalKm*100).toFixed(1)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.ruleBox}>
          <span>📋 목표 <b>{goalKm}km</b> · 벌칙: <b>{penalty}</b> · 매주 월요일 리셋</span>
        </div>
      </div>
    </main>
  )
}
