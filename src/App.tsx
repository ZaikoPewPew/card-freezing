import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { DistortionWave } from "distortion-waves";

/* ---------- the Alfa mark, same symbol as in convert-card ---------- */
const Mark = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
    <path fillRule="evenodd" d="M41 10c2.4-5.4 15.6-5.4 18 0l26 66H70.4l-5.6-15H35.2l-5.6 15H15zM50 24 39.6 50h20.8z" />
    <rect x="15" y="84" width="70" height="11" />
  </svg>
);

const Snowflake = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
    <path d="m9 4 3 2.2L15 4M9 20l3-2.2 3 2.2M3.6 10.6l3.4-.4-1.2-3.3M20.4 13.4l-3.4.4 1.2 3.3M5.8 17.1 7 13.8l-3.4-.4M18.2 6.9 17 10.2l3.4.4" />
  </svg>
);

const Sun = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

/* ---------- the plastic: red card with foil that follows the pointer; frozen it frosts over ---------- */
function BankCard({ frozen }: { frozen?: boolean }) {
  const [light, setLight] = useState({ x: 50, y: 50, hyp: 0 });
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (frozen) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    setLight({ x: x * 100, y: y * 100, hyp: Math.min(1, Math.hypot(x - .5, y - .5) * 2) });
  };
  const style = {
    "--px": light.x, "--py": light.y, "--hyp": light.hyp,
    "--rx": `${((light.y - 50) / 50) * -6}deg`, "--ry": `${((light.x - 50) / 50) * 8}deg`,
  } as CSSProperties;
  return (
    <div className={`bank${frozen ? " frozen" : ""}`} style={style} onPointerMove={move} onPointerLeave={() => setLight({ x: 50, y: 50, hyp: 0 })}>
      <div className="plastic">
        <i className="holo" /><i className="glare" />
        {frozen && <><i className="frost" /><i className="crystals" /></>}
        <Mark className="logo" />
        <span className="bank-name">Альфа-Карта</span>
        <i className="chip" />
        <svg className="contactless" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 8.5a5 5 0 0 1 0 7" /><path d="M11.5 6a9 9 0 0 1 0 12" /><path d="M15 3.5a13 13 0 0 1 0 17" /></g></svg>
        <span className="pan">•• 4821</span>
        <span className="exp">08/29</span>
        {frozen && <span className="ice-badge"><Snowflake size={14} /> Заморожена</span>}
        <i className="glaze" />
      </div>
    </div>
  );
}

function Row({ label, value, off }: { label: string; value: string; off?: boolean }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span className={off ? "val off" : "val"}>{value}</span>
    </div>
  );
}

function ActiveView() {
  return (
    <section className="view active">
      <header>
        <p className="eyebrow">Дебетовая карта</p>
        <h1>48 250,00 ₽</h1>
        <span className="pill on"><i />Активна</span>
      </header>
      <BankCard />
      <div className="rows">
        <Row label="Покупки онлайн" value="Включены" />
        <Row label="Оплата телефоном" value="Включена" />
        <Row label="Снятие наличных" value="До 300 000 ₽" />
      </div>
    </section>
  );
}

function FrozenView() {
  return (
    <section className="view cold">
      <header>
        <p className="eyebrow">Дебетовая карта</p>
        <h1>48 250,00 ₽</h1>
        <span className="pill ice"><Snowflake size={12} />Заморожена</span>
      </header>
      <BankCard frozen />
      <div className="rows">
        <Row label="Покупки онлайн" value="Недоступны" off />
        <Row label="Оплата телефоном" value="Недоступна" off />
        <Row label="Снятие наличных" value="Недоступно" off />
      </div>
      <p className="note">Пока карта заморожена, ей никто не сможет расплатиться. Деньги на счёте в безопасности, разморозить можно в любой момент.</p>
    </section>
  );
}

export function App() {
  const [frozen, setFrozen] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  const toggle = () => { setBusy(true); setFrozen(f => !f); };

  return (
    <main className="stage">
      <p className="hint">Заморозка карты · нажми кнопку внизу</p>
      <DistortionWave
        className="sheet"
        revealed={frozen}
        source={button}
        type="vertical"
        palette="ocean"
        waveStyle={{ particleCount: 46 }}
        onFinish={() => setBusy(false)}
        revealedContent={<FrozenView />}
        overlay={
          <button
            ref={button}
            type="button"
            className={`action${frozen ? " thaw" : ""}`}
            onClick={toggle}
            aria-busy={busy}
            aria-pressed={frozen}
          >
            {frozen ? <Sun /> : <Snowflake />}
            {frozen ? "Разморозить карту" : "Заморозить карту"}
          </button>
        }
      >
        <ActiveView />
      </DistortionWave>
    </main>
  );
}
