import React, { useEffect, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

export default function BrowserWarningModal({ onConfirm }) {
  const [remember, setRemember] = useState(false);
  const cardRef = useRef(null);
  const confirmRef = useRef(null);
  const previousFocusRef = useRef(null);
  const confirmHandlerRef = useRef(() => {});

  useEffect(() => {
    confirmHandlerRef.current = () => onConfirm(remember);
  });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    confirmRef.current?.focus();

    const handleConfirm = () => confirmHandlerRef.current();

    const getFocusable = () =>
      Array.from(cardRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter(
        (node) => !node.hasAttribute('disabled')
      );

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleConfirm();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;

      const nodes = getFocusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (!cardRef.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const previous = previousFocusRef.current;
      if (
        previous &&
        previous !== document.body &&
        document.contains(previous) &&
        !cardRef.current?.contains(previous)
      ) {
        previous.focus();
      }
    };
  }, []);

  return (
    <div className="browser-warning-backdrop">
      <div
        className="browser-warning-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="browser-warning-title"
        aria-describedby="browser-warning-text browser-warning-hint"
        ref={cardRef}
      >
        <h2 id="browser-warning-title" className="browser-warning-title">
          Приложение работает только в Chromium-браузерах
        </h2>
        <p id="browser-warning-text" className="browser-warning-text">
          PrivateAI запускает модель прямо в браузере и требует Chromium: Google Chrome, Microsoft
          Edge, Brave, Opera, Vivaldi и другие. В Firefox, Safari и на iOS приложение не сможет
          загрузить модель.
        </p>
        <p id="browser-warning-hint" className="browser-warning-hint">
          Откройте эту страницу в Chromium-браузере на компьютере.
        </p>
        <div className="browser-warning-actions">
          <label className="browser-warning-checkbox" htmlFor="browser-warning-dismiss">
            <input
              id="browser-warning-dismiss"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Не показывать снова</span>
          </label>
          <button
            type="button"
            className="btn-main browser-warning-continue"
            ref={confirmRef}
            onClick={() => onConfirm(remember)}
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  );
}
