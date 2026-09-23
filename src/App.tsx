import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MapView } from './components/MapView'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type {
  ConsentAcceptance,
  ConsentVersion,
  Coordinates,
  OnomatopoeiaRecord,
  ProjectMembership,
} from './types'
import './App.css'

function App() {
  const demoMode = new URLSearchParams(window.location.search).has('demo')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountLoading, setAccountLoading] = useState(false)
  const [activeConsent, setActiveConsent] = useState<ConsentVersion | null>(null)
  const [acceptance, setAcceptance] = useState<ConsentAcceptance | null>(null)
  const [membership, setMembership] = useState<ProjectMembership | null>(null)
  const [records, setRecords] = useState<OnomatopoeiaRecord[]>([])
  const [fatalError, setFatalError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadAccount = useCallback(async () => {
    if (!supabase || !session) return
    setAccountLoading(true)
    setFatalError('')

    const consentResult = await supabase
      .from('consent_versions')
      .select('id, version, title, body, published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (consentResult.error) {
      setFatalError('同意情報を読み込めませんでした。設定を確認してください。')
      setAccountLoading(false)
      return
    }

    const consent = consentResult.data as ConsentVersion | null
    setActiveConsent(consent)

    if (consent) {
      const acceptanceResult = await supabase
        .from('consent_acceptances')
        .select('id, consent_version_id, accepted_at')
        .eq('user_id', session.user.id)
        .eq('consent_version_id', consent.id)
        .maybeSingle()
      setAcceptance(acceptanceResult.data as ConsentAcceptance | null)
    } else {
      setAcceptance(null)
    }

    const membershipResult = await supabase
      .from('project_memberships')
      .select('project_id, projects(name)')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setMembership(membershipResult.data as unknown as ProjectMembership | null)

    const recordsResult = await supabase
      .from('onomatopoeia_records')
      .select('id, onomatopoeia, description, latitude, longitude, accuracy_m, photo_path, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(200)

    if (!recordsResult.error) {
      setRecords((recordsResult.data ?? []) as OnomatopoeiaRecord[])
    }
    setAccountLoading(false)
  }, [session])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  if (demoMode) return <DemoExperience />
  if (!isSupabaseConfigured) return <SetupRequired />
  if (authLoading) return <LoadingScreen message="アプリを準備しています" />
  if (!session) return <AuthScreen />
  if (accountLoading) return <LoadingScreen message="アカウントを確認しています" />
  if (fatalError) return <ErrorScreen message={fatalError} retry={loadAccount} />
  if (!activeConsent) return <ConsentMissing signOut={() => supabase?.auth.signOut()} />
  if (!acceptance) {
    return (
      <ConsentScreen
        consent={activeConsent}
        userId={session.user.id}
        onAccepted={(nextAcceptance) => setAcceptance(nextAcceptance)}
      />
    )
  }

  return (
    <MapScreen
      session={session}
      acceptance={acceptance}
      membership={membership}
      records={records}
      onCreated={(record) => setRecords((current) => [record, ...current])}
    />
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">HU</span>
      <span>HUMAI まち歩き</span>
    </div>
  )
}

function AuthScreen({ demoMode = false, onDemoAuthenticated }: {
  demoMode?: boolean
  onDemoAuthenticated?: (email: string, projectCode: string) => void
} = {}) {
  const [email, setEmail] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [otp, setOtp] = useState('')
  const [stage, setStage] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOtp() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    if (demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      setLoading(false)
      setStage('otp')
      return
    }
    if (!supabase) return
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (authError) {
      setError('確認コードを送信できませんでした。メールアドレスを確認してください。')
      return
    }
    setStage('otp')
  }

  async function verifyOtp() {
    if (otp.trim().length !== 6) return
    setLoading(true)
    setError('')
    if (demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      if (otp !== '123456') {
        setLoading(false)
        setError('デモの確認コードは 123456 です。')
        return
      }
      setLoading(false)
      onDemoAuthenticated?.(email.trim(), projectCode.trim())
      return
    }
    if (!supabase) return
    const { data, error: authError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    })

    if (authError || !data.session) {
      setLoading(false)
      setError('確認コードが正しくないか、有効期限が切れています。')
      return
    }

    if (projectCode.trim()) {
      const { error: projectError } = await supabase.rpc('join_project_by_code', {
        input_code: projectCode.trim(),
      })
      if (projectError) {
        await supabase.auth.signOut()
        setLoading(false)
        setStage('email')
        setOtp('')
        setError('プロジェクトコードを確認できませんでした。コードを修正するか、空欄にしてください。')
        return
      }
    }
    setLoading(false)
  }

  return (
    <main className="auth-page">
      <header><Brand /></header>
      <section className="auth-intro">
        <p className="eyebrow">ONOMATOPOEIA FIELD NOTE</p>
        <h1>HUMAI<br />オノマトペマップ</h1>
      </section>
      <section className="auth-card">
        {stage === 'email' ? (
          <>
            <h2>メールアドレスで登録</h2>
            <Field label="メールアドレス">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="example@domain.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="プロジェクトコード" optional>
              <input
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="コードをお持ちの方のみ入力"
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value)}
              />
            </Field>
            <p className="field-note">コードなしでも登録できます。入力した場合は確認後、プロジェクトに紐づきます。</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={loading || !email.trim()} onClick={sendOtp}>
              {loading ? '送信中…' : '確認コードを送る'}
            </button>
          </>
        ) : (
          <>
            <button className="text-button" onClick={() => setStage('email')}>← メールアドレスを変更</button>
            <h2>確認コードを入力</h2>
            <p className="card-copy">{email} に届いた6桁のコードを入力してください。</p>
            {demoMode && <p className="demo-code">デモ確認コード：<strong>123456</strong></p>}
            <Field label="確認コード">
              <input
                className="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={loading || otp.length !== 6} onClick={verifyOtp}>
              {loading ? '確認中…' : '登録して次へ'}
            </button>
          </>
        )}
      </section>
    </main>
  )
}

function ConsentScreen({ consent, userId, onAccepted, demoMode = false }: {
  consent: ConsentVersion
  userId: string
  onAccepted: (acceptance: ConsentAcceptance) => void
  demoMode?: boolean
}) {
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    if (!checked) return
    setLoading(true)
    if (demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      onAccepted({ id: 'demo-consent', consent_version_id: consent.id, accepted_at: new Date().toISOString() })
      return
    }
    if (!supabase) return
    const { data, error: insertError } = await supabase
      .from('consent_acceptances')
      .insert({
        user_id: userId,
        consent_version_id: consent.id,
        locale: 'ja',
        accepted_items: { all: true },
      })
      .select('id, consent_version_id, accepted_at')
      .single()
    setLoading(false)
    if (insertError) {
      setError('同意内容を保存できませんでした。通信環境を確認してください。')
      return
    }
    onAccepted(data as ConsentAcceptance)
  }

  return (
    <main className="consent-page">
      <header className="simple-header"><Brand /></header>
      <section className="consent-content">
        <p className="eyebrow accent">CONSENT · VERSION {consent.version}</p>
        <h1>{consent.title}</h1>
        <div className="consent-document">
          {consent.body.split('\n').map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />)}
        </div>
        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>利用目的とプライバシーについて確認しました</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <footer className="sticky-action">
        <button className="primary-button" disabled={!checked || loading} onClick={accept}>
          {loading ? '保存中…' : '同意してはじめる'}
        </button>
      </footer>
    </main>
  )
}

function MapScreen({ session, acceptance, membership, records, onCreated, demoMode = false }: {
  session: Session
  acceptance: ConsentAcceptance
  membership: ProjectMembership | null
  records: OnomatopoeiaRecord[]
  onCreated: (record: OnomatopoeiaRecord) => void
  demoMode?: boolean
}) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(demoMode ? { latitude: 35.6812, longitude: 139.7671, accuracy: 12 } : null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'error'>(demoMode ? 'ready' : 'loading')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })
        setLocationStatus('ready')
      },
      () => setLocationStatus('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    )
  }, [])

  useEffect(() => {
    if (!demoMode) locate()
  }, [demoMode, locate])

  return (
    <main className="map-page">
      <header className="map-header">
        <div><strong>まちの記録</strong><span className="walk-chip"><i />まち歩き中</span></div>
        <button className="menu-button" aria-label="メニュー" onClick={() => setMenuOpen((value) => !value)}>☰</button>
        {menuOpen && (
          <div className="account-menu">
            <small>{session.user.email}</small>
            {membership?.projects?.name && <span>{membership.projects.name}</span>}
            {!demoMode && <button onClick={() => supabase?.auth.signOut()}>ログアウト</button>}
          </div>
        )}
      </header>
      <MapView coordinates={coordinates} records={records} />
      <button className="locate-button" aria-label="現在地を再取得" onClick={locate}>◎</button>
      <div className={`location-status status-${locationStatus}`}>
        {locationStatus === 'loading' && '現在地を取得中…'}
        {locationStatus === 'ready' && `現在地 · 精度 ±${Math.round(coordinates?.accuracy ?? 0)}m`}
        {locationStatus === 'error' && <button onClick={locate}>現在地を取得できません · 再試行</button>}
      </div>
      <button className="record-fab" disabled={!coordinates} onClick={() => setSheetOpen(true)}>＋ この場所で記録</button>
      {sheetOpen && coordinates && (
        <RecordSheet
          coordinates={coordinates}
          userId={session.user.id}
          acceptanceId={acceptance.id}
          projectId={membership?.project_id ?? null}
          demoMode={demoMode}
          onClose={() => setSheetOpen(false)}
          onCreated={(record) => {
            onCreated(record)
            setSheetOpen(false)
          }}
        />
      )}
    </main>
  )
}

function RecordSheet({ coordinates, userId, acceptanceId, projectId, onClose, onCreated, demoMode = false }: {
  coordinates: Coordinates
  userId: string
  acceptanceId: string
  projectId: string | null
  onClose: () => void
  onCreated: (record: OnomatopoeiaRecord) => void
  demoMode?: boolean
}) {
  const [onomatopoeia, setOnomatopoeia] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const previewUrl = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  async function save() {
    if (!onomatopoeia.trim()) return
    if (demoMode) {
      onCreated({
        id: crypto.randomUUID(),
        onomatopoeia: onomatopoeia.trim(),
        description: description.trim() || null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy_m: coordinates.accuracy,
        photo_path: null,
        recorded_at: new Date().toISOString(),
      })
      return
    }
    if (!supabase) return
    setLoading(true)
    setError('')
    let photoPath: string | null = null

    if (photo) {
      const compressed = await compressImage(photo)
      const extension = compressed.type === 'image/png' ? 'png' : 'jpg'
      photoPath = `${userId}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('record-photos').upload(photoPath, compressed, {
        contentType: compressed.type,
        upsert: false,
      })
      if (uploadError) {
        setLoading(false)
        setError('写真を保存できませんでした。写真を外すか、もう一度お試しください。')
        return
      }
    }

    const { data, error: insertError } = await supabase
      .from('onomatopoeia_records')
      .insert({
        user_id: userId,
        project_id: projectId,
        consent_acceptance_id: acceptanceId,
        onomatopoeia: onomatopoeia.trim(),
        description: description.trim() || null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy_m: coordinates.accuracy,
        photo_path: photoPath,
        recorded_at: new Date().toISOString(),
      })
      .select('id, onomatopoeia, description, latitude, longitude, accuracy_m, photo_path, recorded_at')
      .single()

    if (insertError) {
      if (photoPath) await supabase.storage.from('record-photos').remove([photoPath])
      setLoading(false)
      setError('記録を保存できませんでした。通信環境を確認してください。')
      return
    }
    setLoading(false)
    onCreated(data as OnomatopoeiaRecord)
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="record-sheet" role="dialog" aria-modal="true" aria-labelledby="record-title">
        <div className="sheet-handle" />
        <button className="close-button" aria-label="閉じる" onClick={onClose}>×</button>
        <p>この場所で感じた</p>
        <h2 id="record-title">音のことばを記録</h2>
        <Field label="オノマトペ" required>
          <input
            className="onomatopoeia-input"
            autoFocus
            maxLength={28}
            placeholder="たとえば… ざわざわ"
            value={onomatopoeia}
            onChange={(event) => setOnomatopoeia(event.target.value)}
          />
        </Field>
        <Field label="説明" optional>
          <textarea maxLength={500} rows={3} placeholder="この場所で感じたことを自由に書いてください" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <label className={previewUrl ? 'photo-picker has-preview' : 'photo-picker'}>
          {previewUrl ? <img src={previewUrl} alt="選択した写真" /> : <span>▣</span>}
          <strong>{photo ? '写真を変更' : '写真を追加'}</strong>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={loading || !onomatopoeia.trim()} onClick={save}>
          {loading ? '保存中…' : '地図に記録する'}
        </button>
      </section>
    </div>
  )
}

function Field({ label, optional, required, children }: {
  label: string
  optional?: boolean
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span>{label}{optional && <em>任意</em>}{required && <em className="required">必須</em>}</span>
      {children}
    </label>
  )
}

function LoadingScreen({ message }: { message: string }) {
  return <main className="center-screen"><Brand /><span className="spinner" /><p>{message}</p></main>
}

function ErrorScreen({ message, retry }: { message: string; retry: () => void }) {
  return <main className="center-screen"><Brand /><h1>読み込みエラー</h1><p>{message}</p><button className="primary-button" onClick={retry}>もう一度試す</button></main>
}

function ConsentMissing({ signOut }: { signOut: () => void }) {
  return <main className="center-screen"><Brand /><h1>同意文を準備中です</h1><p>管理者が有効な同意文を登録すると利用できます。</p><button className="secondary-button" onClick={signOut}>ログアウト</button></main>
}

function SetupRequired() {
  return <main className="center-screen"><Brand /><h1>セットアップが必要です</h1><p>Supabaseの環境変数を設定するとアプリを利用できます。</p><code>VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY</code><a className="demo-link" href="?demo=1">デモ画面を確認する</a></main>
}

const demoRecords: OnomatopoeiaRecord[] = [
  { id: 'demo-1', onomatopoeia: 'ざわざわ', description: '駅前を行き交う人の声', latitude: 35.6821, longitude: 139.7661, accuracy_m: 10, photo_path: null, recorded_at: new Date().toISOString() },
  { id: 'demo-2', onomatopoeia: 'カタン', description: '線路から聞こえた音', latitude: 35.6799, longitude: 139.7692, accuracy_m: 14, photo_path: null, recorded_at: new Date().toISOString() },
  { id: 'demo-3', onomatopoeia: 'さらさら', description: '街路樹の葉が揺れる音', latitude: 35.6831, longitude: 139.7702, accuracy_m: 9, photo_path: null, recorded_at: new Date().toISOString() },
]

const demoConsent: ConsentVersion = {
  id: 'demo-consent-version',
  version: 'DEMO-1.0',
  title: 'まち歩き調査への参加同意',
  body: 'このデモでは、入力したメールアドレス、プロジェクトコード、オノマトペ、説明、写真、位置情報はサーバーへ保存されません。\n\n本番版では、調査目的・保存期間・閲覧範囲・問い合わせ先を記載した正式な同意文を表示します。',
  published_at: new Date().toISOString(),
}

function DemoExperience() {
  const [stage, setStage] = useState<'auth' | 'consent' | 'map'>('auth')
  const [email, setEmail] = useState('demo@humai.local')
  const [projectCode, setProjectCode] = useState('')
  const [records, setRecords] = useState(demoRecords)
  const session = { user: { id: 'demo-user', email } } as Session

  if (stage === 'auth') {
    return <AuthScreen demoMode onDemoAuthenticated={(nextEmail, nextProjectCode) => {
      setEmail(nextEmail)
      setProjectCode(nextProjectCode)
      setStage('consent')
    }} />
  }
  if (stage === 'consent') {
    return <ConsentScreen consent={demoConsent} userId="demo-user" demoMode onAccepted={() => setStage('map')} />
  }
  return <MapScreen session={session} acceptance={{ id: 'demo-consent', consent_version_id: 'demo', accepted_at: new Date().toISOString() }} membership={projectCode ? { project_id: 'demo-project', projects: { name: `デモプロジェクト（${projectCode}）` } } : null} records={records} onCreated={(record) => setRecords((current) => [record, ...current])} demoMode />
}

async function compressImage(file: File): Promise<Blob> {
  if (file.size <= 1_500_000) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.82))
}

export default App
