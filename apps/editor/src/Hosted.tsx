// Ömer'in gördüğü panel: GitHub yok, token yok. Parolayla gir, yaz, Yayınla.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CloudUpload, KeyRound, Loader2, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageBody, PageHeader, PageShell, Surface } from './components/PageShell'
import { hostedLogin, hostedPublish, hostedSession, hostedSetPassword } from './browser/hosted'

type Phase = 'loading' | 'login' | 'setpw' | 'ready'

export function Hosted() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    hostedSession().then((s) => {
      if (!alive) return
      setPhase(s.authed ? (s.hasPassword ? 'ready' : 'setpw') : 'login')
    })
    return () => {
      alive = false
    }
  }, [])

  async function onLogin() {
    if (!password.trim()) return
    setBusy(true)
    try {
      const { mustSetPassword } = await hostedLogin(password)
      setPassword('')
      setPhase(mustSetPassword ? 'setpw' : 'ready')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSetPassword() {
    if (password.length < 8) return toast.error('Parola en az 8 karakter olmalı.')
    if (password !== confirm) return toast.error('Parolalar eşleşmiyor.')
    setBusy(true)
    try {
      await hostedSetPassword(password)
      setPassword('')
      setConfirm('')
      setPhase('ready')
      toast.success('Parola belirlendi.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onPublish() {
    setBusy(true)
    try {
      const result = await hostedPublish()
      if (result.changed === 0 && result.removed === 0) {
        toast.info('Yayınlanacak değişiklik yok.')
        return
      }
      toast.success('Yayınlandı. Site birkaç dakikada güncellenir.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.includes('Oturum yok')) setPhase('login')
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Yayınla"
        subtitle={
          phase === 'ready'
            ? 'Soldan içeriği düzenle, sonra Yayınla’ya bas.'
            : 'Devam etmek için giriş yap.'
        }
        actions={
          phase === 'ready' ? (
            <Button onClick={onPublish} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Yayınla
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <Surface className="grid max-w-md gap-5 p-5">
          {phase === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}

          {phase === 'login' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="pw">Parola</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  autoFocus
                  placeholder="Parola ya da davet kodu"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                />
                <p className="text-xs text-muted-foreground">
                  İlk girişte sana verilen davet kodunu yaz; sonra kendi parolanı belirlersin.
                </p>
              </div>
              <Button onClick={onLogin} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Giriş
              </Button>
            </>
          )}

          {phase === 'setpw' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="npw">Yeni parola</Label>
                <Input
                  id="npw"
                  type="password"
                  value={password}
                  autoFocus
                  placeholder="En az 8 karakter"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpw">Parola (tekrar)</Label>
                <Input
                  id="cpw"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSetPassword()}
                />
              </div>
              <Button onClick={onSetPassword} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Parolayı kaydet
              </Button>
            </>
          )}

          {phase === 'ready' && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                İçeriği soldaki menüden düzenle. Bittiğinde üstteki Yayınla’ya bas.
              </p>
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setPhase('setpw')}>
                <KeyRound className="h-4 w-4" />
                Parolayı değiştir
              </Button>
            </div>
          )}
        </Surface>
      </PageBody>
    </PageShell>
  )
}
