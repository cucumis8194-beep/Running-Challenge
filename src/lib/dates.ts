function getKstDate(date = new Date()): Date {
  const kstOffset = 9 * 60
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + kstOffset * 60000)
}

export function getWeekStart(date = new Date()): string {
  const kst = getKstDate(date)
  const day = kst.getDay()
  const diff = day === 0 ? -6 : 1 - day
  kst.setDate(kst.getDate() + diff)
  return `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,'0')}-${String(kst.getDate()).padStart(2,'0')}`
}

export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getWeekDates(weekStart: string): Date[] {
  const start = new Date(weekStart + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function formatDateKr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

export function formatWeekRange(weekStart: string): string {
  const end = getWeekEnd(weekStart)
  return `${formatDateKr(weekStart)} ~ ${formatDateKr(end)}`
}

export function getTodayKst(): string {
  const kst = getKstDate()
  return `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,'0')}-${String(kst.getDate()).padStart(2,'0')}`
}
