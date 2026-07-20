import { Download, ExternalLink, MonitorDown, Share, Smartphone, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface InstallDialogProps {
  canInstall: boolean;
  installed: boolean;
  onInstall: () => Promise<boolean>;
  onClose: () => void;
}

export function InstallDialog({ canInstall, installed, onInstall, onClose }: InstallDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop account-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <header><div><span className="dialog-icon"><Download /></span><div><h2 id="install-title">Install NOCTURNE</h2><p>Full-screen, fast launch, and offline market snapshot.</p></div></div><button ref={closeButton} className="dialog-close" onClick={onClose} aria-label="Close install guide"><X /></button></header>
        {installed ? <div className="installed-state"><MonitorDown /><strong>Already installed</strong><p>Launch NOCTURNE from your home screen or applications menu.</p></div> : null}
        {!installed && canInstall ? <button className="install-primary" onClick={() => void onInstall().then((accepted) => { if (accepted) onClose(); })}><Download />Install this app</button> : null}
        {!installed && !canInstall ? <div className="install-options">
          <div><Smartphone /><span><strong>iPhone / iPad</strong><small>Tap <Share /> Share, then “Add to Home Screen”.</small></span></div>
          <div><MonitorDown /><span><strong>Chrome / Edge desktop</strong><small>Use the install icon in the address bar or browser menu.</small></span></div>
        </div> : null}
        <a className="action-download-link" href="https://github.com/daniel-techAI/CryptoFuck/actions/workflows/app-package.yml" target="_blank" rel="noreferrer"><Download />Download the latest Actions package <ExternalLink /></a>
        <p className="install-note">The installed app and web version use the same verified code. Updates arrive automatically.</p>
      </section>
    </div>
  );
}
