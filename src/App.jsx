import React, { useEffect, useRef, useState } from 'react';
import { getSavedFileHandle, verifyPermission, selectAndSaveFile, saveFilePicker, saveFileHandle } from './services/fileStorage';
import { AIRuntime } from './services/AIRuntime';
import { loadExecutionSettings } from './services/executionSettings';
import { APP_VERSION } from './version';
import { isChromiumBased, isBrowserWarningDismissed, dismissBrowserWarning, resetBrowserWarningDismissal } from './services/browserSupport';
import WelcomeScreen from './components/WelcomeScreen';
import AccessScreen from './components/AccessScreen';
import LoadingScreen from './components/LoadingScreen';
import ChatWorkspace from './components/ChatWorkspace';
import BrowserWarningModal from './components/BrowserWarningModal';

export default function App() {
  const runtimeRef = useRef(null);
  const [status, setStatus] = useState('checking');
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [envInfo, setEnvInfo] = useState({});
  const [isCancelling, setIsCancelling] = useState(false);
  const [isChromium] = useState(() => isChromiumBased());
  const [showBrowserWarning, setShowBrowserWarning] = useState(
    () => !isChromium && !isBrowserWarningDismissed()
  );

  if (!runtimeRef.current) runtimeRef.current = new AIRuntime();
  const runtime = runtimeRef.current;

  useEffect(() => {
    const gpu = !!navigator.gpu;
    const coop = window.crossOriginIsolated;
    const isFirefox = navigator.userAgent.includes('Firefox');
    const browser = isFirefox ? 'Firefox' : isChromium ? 'Chromium' : 'Other';
    setEnvInfo({ gpu, coop, isFirefox, browser, cores: navigator.hardwareConcurrency });

    let cancelled = false;
    (async () => {
      try {
        const handle = await getSavedFileHandle();
        if (cancelled) return;
        if (handle) {
          setFileHandle(handle);
          setFileName(handle.name);
          setStatus('access');
        } else {
          setStatus('welcome');
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Не удалось восстановить сохранённый файл:', err);
        setFileHandle(null);
        setFileName('');
        setStatus('welcome');
      }
    })();

    return () => {
      cancelled = true;
      runtime.unloadModel().catch(() => {});
    };
  }, [runtime]);

  const getExecutionSettings = () => loadExecutionSettings();

  const getLoadReturnStatus = () => (status === 'chat' ? 'chat' : 'access');

  const handleSkipModel = () => {
    setError('');
    setStatus('chat');
  };

  const handleSelectFile = async () => {
    const returnStatus = getLoadReturnStatus();
    setError('');
    const handle = await selectAndSaveFile();
    if (handle) {
      setFileHandle(handle);
      setFileName(handle.name);
      await handleStartModel(handle, getExecutionSettings(), returnStatus);
    }
  };

  const handleLoadFromHF = async () => {
    const returnStatus = getLoadReturnStatus();
    setError('');
    const handle = await saveFilePicker('Qwen3.8-2B-Q4_K_M.gguf');
    if (!handle) return;

    setFileHandle(handle);
    setFileName(handle.name);
    setStatus('loading');
    setProgress(0);
    try {
      const result = await runtime.loadModelFromHF(setProgress, handle, getExecutionSettings());
      if (result?.fileHandle) await saveFileHandle(result.fileHandle);
      setStatus('chat');
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus(returnStatus);
        setProgress(0);
        setError('');
      } else {
        setError('HF ошибка: ' + err.message);
        setStatus(returnStatus);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartModel = async (handle = fileHandle, executionSettings = getExecutionSettings(), returnStatus = 'access') => {
    setError('');
    if (!handle) return;
    try {
      const hasPermission = await verifyPermission(handle);
      if (!hasPermission) {
        setError('Доступ к файлу отклонен');
        return;
      }
      setStatus('loading');
      setProgress(0);
      await runtime.loadModelFromFile(handle, setProgress, executionSettings);
      setStatus('chat');
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus(returnStatus);
        setProgress(0);
        setError('');
      } else {
        setError('Ошибка: ' + err.message);
        setStatus(returnStatus);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUnload = async () => {
    await runtime.unloadModel();
    setStatus(fileHandle ? 'access' : 'welcome');
  };

  const handleApplyExecutionSettings = async (settings) => {
    if (!fileHandle) throw new Error('Файл модели недоступен для перезагрузки');
    if (runtime.isGenerationPending?.() || runtime.isLoadPending?.()) throw new Error('Дождитесь завершения текущей операции');
    await runtime.unloadModel();
    await handleStartModel(fileHandle, settings, 'chat');
  };

  const handleCancel = () => {
    runtime.cancelLoad();
    setIsCancelling(true);
    setProgress(0);
    setError('');
  };

  const envBanner = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: envInfo.gpu ? '#1a3a1a' : '#3a1a1a',
      color: envInfo.gpu ? '#a6e3a1' : '#f38ba8',
      padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
      display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap'
    }}>
      <span>App: v{APP_VERSION}</span>
      <span>B: {envInfo.browser}</span>
      <span>WebGPU: {envInfo.gpu ? '✓ available' : '✗ unavailable'}</span>
      <span>COOP: {envInfo.coop ? '✓' : '✗'}</span>
      <span>Cores: {envInfo.cores}</span>
    </div>
  );

  const handleBrowserWarningConfirm = (remember) => {
    if (remember) dismissBrowserWarning();
    else resetBrowserWarningDismissal();
    setShowBrowserWarning(false);
  };

  const browserWarning = showBrowserWarning ? (
    <BrowserWarningModal onConfirm={handleBrowserWarningConfirm} />
  ) : null;

  let screen = null;
  if (status === 'checking') screen = <div className="centered">Проверка среды...</div>;
  else if (status === 'welcome')
    screen = (
      <div>
        {envBanner}
        <WelcomeScreen onSelect={handleSelectFile} onHF={handleLoadFromHF} onSkip={handleSkipModel} error={error} />
      </div>
    );
  else if (status === 'access')
    screen = (
      <div>
        {envBanner}
        <AccessScreen fileName={fileName} onConfirm={() => handleStartModel()} onReset={handleSelectFile} onHF={handleLoadFromHF} onSkip={handleSkipModel} error={error} />
      </div>
    );
  else if (status === 'loading')
    screen = (
      <div>
        {envBanner}
        <LoadingScreen progress={progress} fileName={fileName} error={error} onCancel={isCancelling ? undefined : handleCancel} />
      </div>
    );
  else if (status === 'chat')
    screen = (
      <div>
        {envBanner}
        <ChatWorkspace runtime={runtime} fileName={fileName} onUnload={handleUnload} onApplyExecutionSettings={handleApplyExecutionSettings} onSelectModel={handleSelectFile} onLoadFromHF={handleLoadFromHF} modelError={error} />
      </div>
    );

  if (!screen && !browserWarning) return null;
  return (
    <div>
      {screen}
      {browserWarning}
    </div>
  );
}
