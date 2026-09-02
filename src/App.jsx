import React, { useState, useEffect } from 'react';
import { getSavedFileHandle, verifyPermission, selectAndSaveFile, saveFilePicker } from './services/fileStorage';
import { loadModelFromFile, loadModelFromHF, unloadModel, cancelLoad, isLoadPending } from './services/aiService';
import WelcomeScreen from './components/WelcomeScreen';
import AccessScreen from './components/AccessScreen';
import LoadingScreen from './components/LoadingScreen';
import ChatWorkspace from './components/ChatWorkspace';

export default function App() {
  const [status, setStatus] = useState('checking');
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [envInfo, setEnvInfo] = useState({});
  const [isCancelling, setIsCancelling] = useState(false);
  const [saveLocationHandle, setSaveLocationHandle] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const gpu = !!navigator.gpu;
    const coop = window.crossOriginIsolated;
    const isFirefox = navigator.userAgent.includes('Firefox');
    const browser = isFirefox ? 'Firefox' : navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other';
    setEnvInfo({ gpu, coop, isFirefox, browser, cores: navigator.hardwareConcurrency });

    async function checkExistingHandle() {
      const handle = await getSavedFileHandle();
      if (handle) {
        setFileHandle(handle);
        setFileName(handle.name);
        setStatus('access');
      } else {
        setStatus('welcome');
      }
    }
    checkExistingHandle();
  }, []);

  const handleSelectFile = async () => {
    setError('');
    const handle = await selectAndSaveFile();
    if (handle) {
      setFileHandle(handle);
      setFileName(handle.name);
      handleStartModel(handle);
    }
  };

  const handleSaveLocation = async () => {
    setError('');
    const handle = await saveFilePicker('Qwen3.8-2B-Q4_K_M.gguf');
    if (handle) {
      setSaveLocationHandle(handle);
      setStatus('loading');
      setProgress(0);
      setIsLoaded(false);
      try {
        const result = await loadModelFromHF(setProgress, handle);
        if (result?.fileHandle) {
          setFileHandle(result.fileHandle);
          setFileName(result.fileHandle.name);
        }
        setStatus('chat');
        setIsLoaded(true);
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('welcome');
          setProgress(0);
          setError('');
        } else {
          setError('HF ошибка: ' + err.message);
          setStatus('welcome');
        }
      }
    }
  };

  const handleLoadFromHF = () => {
    setError('');
    handleSaveLocation();
  };

  const handleStartModel = async (handle = fileHandle) => {
    setError('');
    setIsLoaded(false);
    try {
      const hasPermission = await verifyPermission(handle);
      if (!hasPermission) {
        setError('Доступ к файлу отклонен');
        return;
      }
      setStatus('loading');
      setProgress(0);
      await loadModelFromFile(handle, setProgress);
      setStatus('chat');
    } catch (err) {
      console.error('[App] Error:', err);
      if (err.name === 'AbortError') {
        setStatus('welcome');
        setProgress(0);
        setError('');
      } else {
        setError('Ошибка: ' + err.message);
        setStatus('welcome');
      }
    }
  };

  const handleUnload = async () => {
    await unloadModel();
    setStatus('welcome');
    setFileHandle(null);
  };

  const handleCancel = () => {
    cancelLoad();
    setIsCancelling(true);
    setStatus('welcome');
    setProgress(0);
    setError('');
    setTimeout(() => setIsCancelling(false), 300);
  };

  const envBanner = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: envInfo.gpu ? '#1a3a1a' : '#3a1a1a',
      color: envInfo.gpu ? '#a6e3a1' : '#f38ba8',
      padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
      display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap'
    }}>
      <span>B: {envInfo.browser}</span>
      <span>GPU: {envInfo.gpu ? '✓' : '✗'}</span>
      <span>COOP: {envInfo.coop ? '✓' : '✗'}</span>
      <span>Cores: {envInfo.cores}</span>
    </div>
  );

  if (status === 'checking') return <div className="centered">Проверка среды...</div>;
  if (status === 'welcome') return (
    <div>
      {envBanner}
      <WelcomeScreen onSelect={handleSelectFile} onHF={handleLoadFromHF} error={error} />
    </div>
  );
  if (status === 'access') return (
    <div>
      {envBanner}
      <AccessScreen fileName={fileName} onConfirm={() => handleStartModel()} onReset={handleSelectFile} onHF={handleLoadFromHF} error={error} />
    </div>
  );
  if (status === 'loading') return (
    <div>
      {envBanner}
      <LoadingScreen progress={progress} fileName={fileName} error={error} onCancel={isCancelling ? undefined : handleCancel} />
    </div>
  );
  if (status === 'chat') return (
    <div>
      {envBanner}
      <ChatWorkspace fileName={fileName} onUnload={handleUnload} />
    </div>
  );
}
