'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, RunLog } from '@/lib/supabase'
import { getWeekStart, getWeekDates, formatDateKr, formatWeekRange } from '@/lib/dates'
import styles from './RoomDashboard.module.css'

type Props = {
  roomId: string
  nickname: string
  goalKm: number
  penalty: string
  roomName: string
  code: string
  onLeave: () => void
}

type MemberStat = {
  nickname: string
  totalKm: number
  days: number
  done: boolean
}

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']
const WEEK_START = getWeekStart()
const TODAY = new Date().toISOString().slice(0, 10)

export default function RoomDashboard({ roomId, nickname, goalKm, penalty, roomName, code, onLeave }: Props) {
  const [logs, setLogs] = useState<RunLog[]>([])
  const [members, setMembers] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [km, setKm] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  const weekDates = getWeekDates(WEEK_START)
  const todayIdx = (new Date().getDay() + 6) % 7

  const loadData = useCallback(async () => {
    const [{ data: logData }, { data: memberData }] = await Promise.all([
      supabase.from('run_logs').select('*').eq('room_id', roomId).eq('week_start', WEEK_START),
      supabase.from('members').select('nickname').eq('room_id', roomId)
    ])
    if (logData) setLogs(logData as RunLog[])
    if (memberData) setMembers(memberData.map((m: { nickname: string }) => m.nickname))
  }, [roomId])

  useEffect(() => {
    loadData()
    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'run_logs', filter: `room_id=eq.${roomId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, loadData])

  function getMemberStats(): MemberStat[] {
    const allNames = Array.from(new Set([...members, nickname]))
    return allNames.map(name => {
      const myLogs = logs.filter(l => l.nickname === name)
      const totalKm = myLogs.reduce((s, l) => s + Number(l.km), 0)
      const days = new Set(myLogs.map(l => l.run_date)).size
      return { nickname: name, totalKm, days, done: totalKm >= goalKm }
    }).sort((a, b) => b.totalKm - a.totalKm)
  }

  function getMyKm(): number {
    return logs.filter(l => l.nickname === nickname).reduce((s, l) => s + Number(l.km), 0)
  }

  async function handleAdd() {
    setAddError('')
    const kmVal = parseFloat(km)
    if (isNaN(kmVal) || kmVal <= 0) { setAddError('거리를 입력하세요.'); return }
    if (!selectedDate) { setAddError('날짜를 선택하세요.'); return }
    setAdding(true)
    const { error } = await supabase.from('run_logs').insert({
      room_id: roomId, nickname, run_date: selectedDate, km: kmVal, week_start: WEEK_START
    })
    if (error) { setAddError('저장 실패. 다시 시도해주세요.') }
    else { setKm(''); await loadData() }
    setAdding(false)
  }

  async function handleDeleteLog(id: string) {
    await supabase.from('run_logs').delete().eq('id', id)
    await loadData()
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const myKm = getMyKm()
  const pct = Math.min(100, (myKm / goalKm) * 100)
  const daysLeft = 7 - todayIdx
  const isDone = myKm >= goalKm
  const isLastDay = todayIdx === 6
  const stats = getMemberStats()
  const myLogs = logs.filter(l => l.nickname === nickname).sort((a, b) => b.run_date.localeCompare(a.run_date))

  return (
    <main className={styles.main}>
      <div className={styles.container}>

        <div className={styles.topBar}>
          <div>
            <div className={styles.roomName}>{roomName}</div>
            <div className={styles.weekRange}>{formatWeekRange(WEEK_START)}</div>
          </div>
          <div className={styles.topRight}>
            <button className={styles.codeBtn} onClick={copyCode}>
              {copied ? '✓ 복사됨' : `코드: ${code}`}
            </button>
            <button className={styles.leaveBtn} onClick={onLeave}>나가기</button>
          </div>
        </div>

        <div className={styles.myCard}>
          <div className={styles.myTop}>
            <div>
              <span className={styles.myKm}>{myKm.toFixed(1)}</span>
              <span className={styles.myKmUnit}> / {goalKm}km</span>
            </div>
            <span className={`${styles.badge} ${isDone ? styles.badgeDone : isLastDay && !isDone ? styles.badgeFail : styles.badgeProgress}`}>
              {isDone ? '✓ 달성!' : isLastDay ? '오늘 마감!' : `${daysLeft}일 남음`}
            </span>
          </div>
          <div className={styles.progBg}>
            <div className={`${styles.progFill} ${isDone ? styles.fillDone : isLastDay ? styles.fillDanger : styles.fillProgress}`}
              style={{ width: `${pct.toFixed(1)}%` }} />
          </div>
          {isDone
            ? <p className={styles.statusOk}>이번 주 미션 완료! {penalty} 안 사도 됩니다 🎉</p>
            : <p className={styles.statusWarn}>목표까지 {(goalKm - myKm).toFixed(1)}km 더 달려야 해요. 못 채우면 → <b>{penalty}</b></p>
          }
        </div>

        <div className={styles.daysGrid}>
          {weekDates.map((d, i) => {
            const dateStr = d.toISOString().slice(0, 10)
            const dayLogs = logs.filter(l => l.nickname === nickname && l.run_date === dateStr)
            const dayKm = dayLogs.reduce((s, l) => s + Number(l.km), 0)
            const isToday = i === todayIdx
            const isPast = i < todayIdx
            return (
              <div key={i} className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${dayKm > 0 ? styles.dayCellRan : ''} ${i > todayIdx ? styles.dayCellFuture : ''}`}
                onClick={() => i <= todayIdx && setSelectedDate(dateStr)}>
                <div className={styles.dayName}>{DAY_KR[d.getDay()]}</div>
                <div className={styles.dayKm}>{dayKm > 0 ? `${dayKm.toFixed(1)}` : isPast ? '—' : ''}</div>
              </div>
            )
          })}
        </div>

        <div className={styles.addCard}>
          <div className={styles.addLabel}>달린 거리 추가</div>
          <div className={styles.addRow}>
            <select className={styles.select} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
              {weekDates.slice(0, todayIdx + 1).map((d, i) => {
                const ds = d.toISOString().slice(0, 10)
                return <option key={i} value={ds}>{DAY_KR[d.getDay()]}요일 ({formatDateKr(ds)})</option>
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
            <div className={styles.logTitle}>내 기록</div>
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

        <div className={styles.leaderboard}>
          <div className={styles.lbTitle}>친구들 현황 <span className={styles.lbMeta}>{stats.length}명 참가 중</span></div>
          {stats.map((s, rank) => {
            const p = Math.min(100, (s.totalKm / goalKm) * 100)
            const isMe = s.nickname === nickname
            return (
              <div key={s.nickname} className={`${styles.lbRow} ${isMe ? styles.lbRowMe : ''}`}>
                <div className={styles.lbRank}>{rank + 1}</div>
                <div className={styles.lbInfo}>
                  <div className={styles.lbName}>
                    {s.nickname} {isMe && <span className={styles.meTag}>나</span>}
                    <span className={`${styles.lbBadge} ${s.done ? styles.lbBadgeDone : isLastDay ? styles.lbBadgeFail : styles.lbBadgeProgress}`}>
                      {s.done ? '완료' : isLastDay ? '실패' : '진행 중'}
                    </span>
                  </div>
                  <div className={styles.lbSub}>{s.totalKm.toFixed(1)}km · {s.days}일 기록</div>
                  <div className={styles.lbProgBg}>
                    <div className={`${styles.lbProgFill} ${s.done ? styles.fillDone : isLastDay ? styles.fillDanger : styles.fillProgress}`}
                      style={{ width: `${p.toFixed(1)}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.ruleBox}>
          <span className={styles.ruleIcon}>📋</span>
          <span>주간 목표 <b>{goalKm}km</b> · 벌칙: <b>{penalty}</b> · 매주 월요일 리셋</span>
        </div>
      </div>
    </main>
  )
}
