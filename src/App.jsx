import React, { useEffect, useRef, useState } from 'react';
import { getSavedFileHandle, verifyPermission, selectAndSaveFile, saveFilePicker, saveFileHandle } from './services/fileStorage';
import { AIRuntime } from './services/AIRuntime';
import { loadExecutionSettings } from './services/executionSettings';
import { APP_VERSION } from './version';
import WelcomeScreen from './components/WelcomeScreen';
import AccessScreen from './components/AccessScreen';
import LoadingScreen from './components/LoadingScreen';
import ChatWorkspace from './components/ChatWorkspace';

export default function App() {
  const runtimeRef = useRef(null);
  const [status, setStatus] = useState('checking');
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [envInfo, setEnvInfo] = useState({});
  const [isCancelling, setIsCancelling] = useState(false);

  if (!runtimeRef.current) runtimeRef.current = new AIRuntime();
  const runtime = runtimeRef.current;

  useEffect(() => {
    const gpu = !!navigator.gpu;
    const coop = window.crossOriginIsolated;
    const isFirefox = navigator.userAgent.includes('Firefox');
    const browser = isFirefox ? 'Firefox' : navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other';
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

  const handleSelectFile = async () => {
    setError('');
    const handle = await selectAndSaveFile();
    if (handle) {
      setFileHandle(handle);
      setFileName(handle.name);
      await handleStartModel(handle);
    }
  };

  const handleLoadFromHF = async () => {
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
        setStatus('access');
        setProgress(0);
        setError('');
      } else {
        setError('HF ошибка: ' + err.message);
        setStatus('access');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartModel = async (handle = fileHandle, executionSettings = getExecutionSettings()) => {
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
        setStatus('access');
        setProgress(0);
        setError('');
      } else {
        setError('Ошибка: ' + err.message);
        setStatus('access');
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
    await handleStartModel(fileHandle, settings);
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

  if (status === 'checking') return <div className="centered">Проверка среды...</div>;
  if (status === 'welcome') return <div>{envBanner}<WelcomeScreen onSelect={handleSelectFile} onHF={handleLoadFromHF} error={error} /></div>;
  if (status === 'access') return <div>{envBanner}<AccessScreen fileName={fileName} onConfirm={() => handleStartModel()} onReset={handleSelectFile} onHF={handleLoadFromHF} error={error} /></div>;
  if (status === 'loading') return <div>{envBanner}<LoadingScreen progress={progress} fileName={fileName} error={error} onCancel={isCancelling ? undefined : handleCancel} /></div>;
  if (status === 'chat') return <div>{envBanner}<ChatWorkspace runtime={runtime} fileName={fileName} onUnload={handleUnload} onApplyExecutionSettings={handleApplyExecutionSettings} /></div>;
  return null;
}
