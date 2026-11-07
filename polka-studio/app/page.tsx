"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, FlipHorizontal2, Heart, Image as ImageIcon, Loader2, LockKeyhole, Maximize, ShieldCheck, SlidersHorizontal, Sparkles, Timer, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { FILTERS, usePhotobooth, type FilterId } from "@/lib/use-photobooth";
import { downloadStrip } from "@/lib/download-strip";

const COLORS = [{ name: "Vanilla", value: "#fffdf7" }, { name: "Blush", value: "#f4c9ce" }, { name: "Butter", value: "#f3de99" }, { name: "Lilac", value: "#d8caed" }, { name: "Cherry", value: "#c53732" }, { name: "Midnight", value: "#30312f" }];
const EFFECT_ORDER: string[] = ["original", "left-mirror", "right-mirror", "top-mirror", "bottom-mirror", "quad-mirror", "upside-down", "switch", "kaleidoscope", "noir", "vintage", "rosy", "golden", "vivid", "fisheye", "swirl"];
const EFFECTS = [...FILTERS].sort((a, b) => EFFECT_ORDER.indexOf(a.id) - EFFECT_ORDER.indexOf(b.id));
const EFFECTS_PER_PAGE = 9;
type Layout = "strip" | "grid" | "single";
type Modal = "help" | "photos" | null;
type ToolPanel = "filters" | "edit";

function LayoutGlyph({ layout }: { layout: Layout }) {
  return <span className={`layout-glyph layout-glyph-${layout}`} aria-hidden="true">{Array.from({ length: layout === "single" ? 1 : 4 }, (_, i) => <i key={i} />)}</span>;
}
function PolkaCamera() {
  return <div className="camera-art" aria-hidden="true"><span className="art-spark art-spark-one">✦</span><span className="art-spark art-spark-two">✧</span><div className="art-paper art-paper-back" /><div className="art-paper art-paper-front"><Camera strokeWidth={1.4} /><span className="art-dot" /></div><span className="art-orbit" /><span className="art-speck" /></div>;
}

export default function Home() {
  const booth = usePhotobooth();
  const [layout, setLayout] = useState<Layout>("strip");
  const [frame, setFrame] = useState(COLORS[0].value);
  const [dots, setDots] = useState(true);
  const [delay, setDelay] = useState(3);
  const [caption, setCaption] = useState("a little moment, forever.");
  const [sound, setSound] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [openPanels, setOpenPanels] = useState<ToolPanel[]>([]);
  const [mobileTools, setMobileTools] = useState(false);
  const [effectPage, setEffectPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [date, setDate] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const previousPanelsRef = useRef<ToolPanel[]>([]);
  const toolsRef = useRef<HTMLDivElement>(null);
  const effectCanvasRefs = useRef(new Map<FilterId, HTMLCanvasElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const active = booth.cameraStatus === "ready" || booth.cameraStatus === "demo";
  const count = layout === "single" ? 1 : 4;
  const visiblePhotos = booth.photos.slice(0, count);
  const selectedFilter = FILTERS.find(f => f.id === booth.filterId) ?? FILTERS[0];
  const darkFrame = frame === "#c53732" || frame === "#30312f";
  const filtersOpen = openPanels.includes("filters");
  const editOpen = openPanels.includes("edit");
  const toolsOpen = openPanels.length > 0;
  const mobileToolsOpen = mobileTools && editOpen && !filtersOpen;
  const effectPages = Math.ceil(EFFECTS.length / EFFECTS_PER_PAGE);
  const pageEffects = EFFECTS.slice(effectPage * EFFECTS_PER_PAGE, (effectPage + 1) * EFFECTS_PER_PAGE);

  useEffect(() => {
    if (!filtersOpen || !active) return;
    let animationFrame = 0;
    let lastUpdate = -Infinity;
    const drawPreviews = (time: number) => {
      if (time - lastUpdate >= 125) {
        for (const effect of EFFECTS.slice(effectPage * EFFECTS_PER_PAGE, (effectPage + 1) * EFFECTS_PER_PAGE)) {
          const canvas = effectCanvasRefs.current.get(effect.id);
          if (canvas) booth.renderEffectPreview(canvas, effect.id);
        }
        lastUpdate = time;
      }
      animationFrame = requestAnimationFrame(drawPreviews);
    };
    animationFrame = requestAnimationFrame(drawPreviews);
    return () => cancelAnimationFrame(animationFrame);
  }, [filtersOpen, active, effectPage, booth.renderEffectPreview]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobileTools(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const previous = previousPanelsRef.current;
    const opened = openPanels.find(name => !previous.includes(name));
    const closed = [...previous].reverse().find(name => !openPanels.includes(name));
    previousPanelsRef.current = openPanels;
    if (opened) {
      const target = opened === "filters"
        ? document.querySelector<HTMLButtonElement>(".effect-tile")
        : mobileTools
          ? toolsRef.current?.querySelector<HTMLButtonElement>('[data-panel-toggle="edit"]')
          : document.querySelector<HTMLButtonElement>("#edit-panel .panel-close");
      target?.focus({ preventScroll: true });
    } else if (closed) {
      const target = mobileTools && editOpen
        ? toolsRef.current?.querySelector<HTMLButtonElement>(`[data-panel-toggle="${closed}"]`)
        : document.querySelector<HTMLButtonElement>(closed === "filters" ? ".filter-current" : ".camera-edit-toggle");
      target?.focus({ preventScroll: true });
    }
  }, [openPanels, mobileTools, editOpen]);
  useEffect(() => {
    if (!mobileToolsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileToolsOpen]);
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (modal) return;
      if (event.key === "Escape") { event.preventDefault(); setOpenPanels(current => current.slice(0, -1)); }
      if (mobileToolsOpen && event.key === "Tab") {
        const items = Array.from(toolsRef.current?.querySelectorAll<HTMLElement>("button, input, select, a[href], summary") ?? []).filter(element => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toolsOpen, mobileToolsOpen, modal]);

  useEffect(() => { setDate(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())); }, []);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { if (booth.error && active) setNotice(booth.error); }, [booth.error, active]);
  useEffect(() => {
    if (active) viewportRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [active]);
  useEffect(() => {
    if (!modal) return;
    lastFocusRef.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] a, [role="dialog"] input')).filter(el => !el.hasAttribute("disabled"));
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = priorOverflow; lastFocusRef.current?.focus(); };
  }, [modal]);
  useEffect(() => {
    if (!sound || !booth.flash || !audioRef.current) return;
    const ctx = audioRef.current, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = "triangle"; oscillator.frequency.setValueAtTime(650, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + .09);
    gain.gain.setValueAtTime(.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .12);
  }, [booth.flash, sound]);

  async function savePhotos() {
    if (!booth.photos.length) return;
    setDownloading(true);
    try { await downloadStrip(visiblePhotos, { color: frame, dots, caption, layout: layout === "grid" ? "grid" : "strip", date }); setNotice("A little memory, saved. Your download is ready!"); }
    catch { setNotice("The download couldn't be created. Please try again."); }
    finally { setDownloading(false); }
  }
  function toggleSound() {
    if (!sound) { try { audioRef.current ??= new AudioContext(); void audioRef.current.resume(); } catch { setNotice("Sound isn't supported in this browser."); return; } }
    setSound(!sound);
  }
  async function expandPreview() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (cameraShellRef.current?.requestFullscreen) await cameraShellRef.current.requestFullscreen(); else setNotice("Your browser doesn't support full-screen preview."); }
    catch { setNotice("Full-screen preview is unavailable in this browser."); }
  }
  function chooseLayout(value: Layout) { if (layout === value) return; setLayout(value); }
  async function togglePanel(next: ToolPanel) {
    if (document.fullscreenElement && next === "edit") await document.exitFullscreen();
    setOpenPanels(current => current.includes(next) ? current.filter(name => name !== next) : [...current, next]);
  }
  function closePanel(name: ToolPanel) { setOpenPanels(current => current.filter(open => open !== name)); }
  function takePhotos() { booth.clearPhotos(); void booth.capture(count, delay); }
  function cycleEffect(direction: number) {
    const index = EFFECTS.findIndex(effect => effect.id === booth.filterId);
    booth.setFilterId(EFFECTS[(index + direction + EFFECTS.length) % EFFECTS.length].id);
  }
  function changeEffectPage(direction: number) { setEffectPage(page => (page + direction + effectPages) % effectPages); }
  function toggleEffects() {
    if (!filtersOpen) setEffectPage(Math.floor(EFFECTS.findIndex(effect => effect.id === booth.filterId) / EFFECTS_PER_PAGE));
    void togglePanel("filters");
  }
  function chooseEffect(id: FilterId) { booth.setFilterId(id); closePanel("filters"); }

  return <div className="site-shell">
    <header className="site-header"><a className="wordmark" href="#" aria-label="Polka home">polka<span>.</span><span className="logo-dots" aria-hidden="true"><i /><i /><i /><i /></span></a><nav aria-label="Main navigation"><a className="nav-active" href="#booth">The photobooth</a><button onClick={() => setModal("help")}>How it works <ArrowRight size={14} /></button></nav><button className="header-snaps" onClick={() => setModal("photos")}><ImageIcon size={17} /><span>Your snaps</span><b>{booth.photos.length}</b></button></header>
    <main id="booth">
      <section className="intro studio-intro effects-intro">
        <p className="eyebrow"><span /> A LITTLE CAMERA. A LOT OF JOY.</p>
        <h1>More smiles. <em>Less serious.</em></h1>
      </section>

      <div className={`studio-workspace effects-workspace ${editOpen ? "edit-is-open" : ""} ${filtersOpen ? "effects-browsing" : ""}`}>

        <section className="centered-booth" aria-label="Photobooth camera">
          <div className="camera-shell" ref={cameraShellRef}>
            <div className={`camera-viewport ${active ? "camera-is-active" : ""}`} ref={viewportRef}>
              <video ref={booth.videoRef} muted playsInline aria-hidden="true" className="source-video" />
              <canvas ref={booth.renderCanvasRef} className="live-canvas" aria-label={`Live camera preview with ${selectedFilter.name} filter`} />
              <div className="viewport-top"><span className={`camera-state ${active ? "state-live" : ""}`}><i />{booth.cameraStatus === "demo" ? "DEMO MODE" : booth.cameraStatus === "ready" ? "YOU'RE LIVE" : "CAMERA OFF"}</span>{active ? <button className="camera-source-action" onClick={() => booth.cameraStatus === "demo" ? void booth.startCamera() : booth.stopCamera()} disabled={booth.isCapturing}>{booth.cameraStatus === "demo" ? "Use my camera" : "Turn camera off"}<ArrowRight size={12} /></button> : <span className="viewport-label">A LITTLE MOMENT, ALL YOURS.</span>}</div>
              {!active && <div className="camera-welcome"><PolkaCamera /><h2>{booth.cameraStatus === "error" ? "Let's try that again." : "Oh, hey there, good lookin’."}</h2><p>{booth.error || "Your next favorite memory starts right here."}</p><button className="primary-button enable-button" disabled={booth.cameraStatus === "loading"} onClick={() => void booth.startCamera()}>{booth.cameraStatus === "loading" ? <Loader2 size={17} className="spin" /> : <Camera size={18} />}{booth.cameraStatus === "loading" ? "Connecting your camera…" : booth.cameraStatus === "error" ? "Try camera again" : "Enable camera"}<ArrowRight size={17} /></button><button className="demo-link" disabled={booth.cameraStatus === "loading"} onClick={() => void booth.useDemo()}>Just looking? Try the demo <ArrowRight size={12} /></button></div>}
              <div id="filters-panel" className="effects-browser" hidden={!filtersOpen} role="group" aria-label="More effects">
                <div className="effects-grid">{pageEffects.map(effect => <button className={`effect-tile ${booth.filterId === effect.id ? "effect-selected" : ""}`} key={effect.id} aria-label={effect.name} aria-pressed={booth.filterId === effect.id} onClick={() => chooseEffect(effect.id)} disabled={booth.isCapturing} data-effect-id={effect.id}><canvas className="effect-preview" width={240} height={150} ref={element => { if (element) effectCanvasRefs.current.set(effect.id, element); else effectCanvasRefs.current.delete(effect.id); }} aria-hidden="true" /><span>{effect.name}</span>{booth.filterId === effect.id && <i className="effect-selected-check"><Check size={12} /></i>}</button>)}</div>
              </div>
              <div className={`camera-controls ${active ? "" : "controls-idle"}`}>
                <button className={`camera-edit-toggle ${editOpen ? "control-active" : ""}`} data-panel-toggle="edit" aria-label="Edit strip" aria-expanded={editOpen} aria-controls="edit-panel" onClick={() => void togglePanel("edit")} disabled={booth.isCapturing} title="Edit strip"><SlidersHorizontal size={20} /></button>
                <div className="filter-stepper">
                  <button className="effect-arrow" aria-label={filtersOpen ? "Previous effects page" : "Previous effect"} onClick={() => filtersOpen ? changeEffectPage(-1) : cycleEffect(-1)} disabled={!active || booth.isCapturing}><ChevronLeft size={23} /></button>
                  <button className="filter-current" data-panel-toggle="filters" aria-label={filtersOpen ? "Back to camera" : "More effects"} aria-expanded={filtersOpen} aria-controls="filters-panel" onClick={toggleEffects} disabled={!active || booth.isCapturing}><strong>{filtersOpen ? "Back to camera" : selectedFilter.name}</strong><span>{filtersOpen ? `${effectPage + 1} / ${effectPages} · ${EFFECTS.length} effects` : "More effects"}</span></button>
                  <button className="effect-arrow" aria-label={filtersOpen ? "Next effects page" : "Next effect"} onClick={() => filtersOpen ? changeEffectPage(1) : cycleEffect(1)} disabled={!active || booth.isCapturing}><ChevronRight size={23} /></button>
                </div>
                <button className="shutter-button camera-shutter" aria-label={booth.isCapturing ? "Taking photos" : booth.photos.length ? "Snap again" : count === 1 ? "Take a photo" : "Take 4 photos"} disabled={!active || booth.isCapturing || filtersOpen} onClick={takePhotos}>{booth.isCapturing ? <Loader2 size={24} className="spin" /> : <Camera size={25} />}<span>{booth.isCapturing ? "…" : count === 1 ? "Snap" : "4 snaps"}</span></button>
              </div>
              <i className="frame-corner corner-tl" /><i className="frame-corner corner-tr" /><i className="frame-corner corner-bl" /><i className="frame-corner corner-br" />
              {booth.countdown !== null && <div className="countdown-overlay" aria-live="assertive"><span key={booth.countdown}>{booth.countdown}</span><p>{booth.captureProgress ? "Another good one. Get ready!" : "Here comes your moment."}</p></div>}
              {booth.flash && <div className="flash-overlay" />}
              {active && !filtersOpen && <button className="expand-button" onClick={() => void expandPreview()} title="Full-screen preview" aria-label="Full-screen preview"><Maximize size={16} /></button>}
            </div>

          </div>
          <p className="capture-note" role="status">{booth.isCapturing ? `Making magic… ${booth.captureProgress} of ${count} snaps.` : <><LockKeyhole size={11} />Your camera. Your photos. Always private.</>}</p>
        </section>

        {mobileToolsOpen && <div className="tools-backdrop" onClick={() => setOpenPanels([])} aria-hidden="true" />}

        <div className={`tool-panels ${filtersOpen ? "tools-with-effects" : ""}`} ref={toolsRef} hidden={!editOpen} role={mobileToolsOpen ? "dialog" : undefined} aria-modal={mobileToolsOpen ? true : undefined} aria-label={mobileToolsOpen ? "Photobooth tools" : undefined}>
          <div className="tools-sheet-bar">
            <button className={`tool-toggle ${filtersOpen ? "tool-open" : ""}`} data-panel-toggle="filters" aria-label="Toggle effects browser" aria-expanded={filtersOpen} aria-controls="filters-panel" onClick={toggleEffects} disabled={!active || booth.isCapturing}><Sparkles size={15} />Effects<ChevronDown size={12} /></button>
            <button className={`tool-toggle ${editOpen ? "tool-open" : ""}`} data-panel-toggle="edit" aria-label="Toggle editing panel" aria-expanded={editOpen} aria-controls="edit-panel" onClick={() => void togglePanel("edit")}><SlidersHorizontal size={15} />Edit strip<ChevronDown size={12} /></button>
            <button className="panel-close" aria-label="Close tools" onClick={() => setOpenPanels([])}><X size={18} /></button>
          </div>
          <div className="tool-panels-scroll">

        <aside id="edit-panel" className="tool-panel edit-panel" hidden={!editOpen} role="region" aria-labelledby="edit-heading">
          <div className="panel-heading"><div><p className="eyebrow">THE LITTLE DETAILS</p><h2 id="edit-heading">Make it yours<span> ✦</span></h2></div><button className="panel-close" aria-label="Close editor" onClick={() => closePanel("edit")}><X size={18} /></button></div>
          <div className="panel-body">
            <div className="settings-card">
              <div className="camera-preferences"><button aria-label="Mirror" aria-pressed={booth.mirror} onClick={() => booth.setMirror(!booth.mirror)} disabled={booth.isCapturing}><FlipHorizontal2 size={16} />Mirror<span>{booth.mirror ? "On" : "Off"}</span></button><button onClick={toggleSound} aria-label={sound ? "Mute shutter sound" : "Enable shutter sound"}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}Shutter sound<span>{sound ? "On" : "Off"}</span></button></div>
              <fieldset disabled={booth.isCapturing}><legend>01 <span>Pick your layout</span></legend><div className="layout-options">{(["strip", "grid", "single"] as Layout[]).map(value => <button className={`layout-option ${layout === value ? "is-selected" : ""}`} key={value} onClick={() => chooseLayout(value)} aria-pressed={layout === value}><LayoutGlyph layout={value} /><span>{value === "strip" ? "Photo strip" : value === "grid" ? "2 × 2 grid" : "Single"}</span></button>)}</div></fieldset>
              <fieldset><legend>02 <span>Find your color</span><span className="chosen-color">{COLORS.find(c => c.value === frame)?.name}</span></legend><div className="color-options">{COLORS.map(color => <button key={color.value} className={`color-swatch ${frame === color.value ? "swatch-selected" : ""}`} style={{ "--swatch": color.value } as React.CSSProperties} aria-label={`${color.name} frame`} aria-pressed={frame === color.value} onClick={() => setFrame(color.value)}>{frame === color.value && <Check size={15} style={{ color: ["Cherry", "Midnight"].includes(color.name) ? "white" : "#35312b" }} />}</button>)}</div><label className="dots-option"><span className="mini-polka" aria-hidden="true" /><span>A sprinkle of polka dots</span><input type="checkbox" checked={dots} onChange={e => setDots(e.target.checked)} /><span className="toggle-switch" aria-hidden="true" /></label></fieldset>
              <fieldset disabled={booth.isCapturing}><legend>03 <span>Take your time</span><Timer size={13} /></legend><div className="timer-options">{[0, 3, 5].map(value => <button key={value} className={delay === value ? "is-selected" : ""} aria-pressed={delay === value} onClick={() => setDelay(value)}>{value === 0 ? "No timer" : `${value} seconds`}</button>)}</div></fieldset>
            </div>
            <div className="keepsake-card"><div className="keepsake-heading"><h2>Your little keepsake</h2><span>{visiblePhotos.length} / {count}</span></div><div className="strip-stage"><span className="tape" aria-hidden="true" /><div className={`photo-strip ${layout === "grid" ? "strip-grid" : ""} ${layout === "single" ? "strip-single" : ""} ${dots ? "strip-dots" : ""} ${darkFrame ? "strip-dark" : ""}`} style={{ "--frame-color": frame } as React.CSSProperties}><div className="strip-photos">{Array.from({ length: count }, (_, i) => <div className="strip-shot" key={i}>{booth.photos[i] ? <><img src={booth.photos[i]} alt={`Your snap ${i + 1}`} /><button className="remove-shot" aria-label={`Remove photo ${i + 1}`} onClick={() => booth.removePhoto(i)} disabled={booth.isCapturing}><X size={10} /></button></> : <><Camera size={14} strokeWidth={1} /><span>0{i + 1}</span></>}</div>)}</div><div className="strip-footer"><strong>polka.</strong><span>{caption || "a little moment, forever."}</span></div></div><span className="strip-annotation" aria-hidden="true">a keeper!<span>↙</span></span></div><label className="caption-label" htmlFor="strip-caption">A little note for your strip</label><input id="strip-caption" className="caption-input" maxLength={40} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Make it a memory…" /><button className="download-button" disabled={!booth.photos.length || downloading || booth.isCapturing} onClick={() => void savePhotos()}>{downloading ? <Loader2 size={16} className="spin" /> : <ArrowDownToLine size={16} />}{downloading ? "Making your keepsake…" : layout === "single" ? "Download photo" : "Download your keepsake"}</button><p className="download-note">{booth.photos.length ? <><Check size={11} />High-quality PNG. Yours to keep.</> : "Your photos will appear here."}</p></div>
          </div>
        </aside>
          </div>
        </div>
      </div>
    </main>

    <footer className="site-footer"><a className="footer-logo" href="#">polka.</a><p>For the moments between the big moments.</p><span>Made with a little <Heart size={12} /> & a lot of dots.</span><button onClick={() => setModal("help")}><CircleHelp size={14} />Need a hand?</button></footer>
    {notice && <div className="toast" role="status"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
    {modal && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className={`modal-card ${modal === "photos" ? "gallery-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-heading"><button ref={closeRef} className="modal-close" onClick={() => setModal(null)} aria-label="Close dialog"><X size={20} /></button><p className="eyebrow">A LITTLE POLKA KNOW-HOW</p><h2 id="modal-heading">{modal === "help" ? "Good memories, made easy." : "Your happy little collection."}</h2>{modal === "help" ? <><div className="help-steps"><div><span>01</span><p><strong>Say hello to your camera.</strong>Choose Enable camera, then allow access in your browser. Feeling shy? Try the demo first.</p></div><div><span>02</span><p><strong>Put your spin on it.</strong>Choose a filter, a layout, and a frame color. Set a timer, gather your people, and press the shutter.</p></div><div><span>03</span><p><strong>Keep a little piece of today.</strong>Download your photo strip as a PNG. Print it, share it, or stick it on your fridge.</p></div></div><div className="privacy-note"><ShieldCheck size={21} /><p><strong>Your moments stay yours.</strong>Photos are processed on your device and stay in this tab. Download your favorites before refreshing or closing.</p></div><details className="camera-help"><summary>Camera being a little camera-shy?</summary><p>Allow camera access using the camera icon in your browser's address bar. Close other apps using the camera, and try again. Use a recent version of Chrome, Edge, Firefox, or Safari over HTTPS or localhost. The demo works without a webcam.</p></details><button className="primary-button" onClick={() => setModal(null)}>Let's make a memory <ArrowRight size={16} /></button></> : booth.photos.length ? <><p className="gallery-copy">This round looks good on you. Download it before starting another.</p><div className="gallery-grid">{booth.photos.map((photo, i) => <div key={`${i}-${photo.length}`}><img src={photo} alt={`Captured photo ${i + 1}`} /><span>SNAP 0{i + 1}</span><button onClick={() => booth.removePhoto(i)} disabled={booth.isCapturing} aria-label={`Delete snap ${i + 1}`}><Trash2 size={15} /></button></div>)}</div><div className="gallery-actions"><button className="text-button" disabled={booth.isCapturing} onClick={() => { booth.clearPhotos(); setModal(null); }}>Clear this round</button><button className="primary-button" disabled={downloading || booth.isCapturing} onClick={() => void savePhotos()}><ArrowDownToLine size={16} />Download {booth.photos.length === 1 ? "photo" : "keepsake"}</button></div></> : <div className="gallery-empty"><ImageIcon size={38} strokeWidth={1} /><h3>A little room for memories.</h3><p>Your snaps will show up here after your first round.</p><button className="primary-button" onClick={() => setModal(null)}>Back to the booth <ArrowRight size={16} /></button></div>}</section></div>}
  </div>;
}
