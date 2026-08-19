import React, { useState, useEffect } from 'react';
import { getSavedFileHandle, verifyPermission, selectAndSaveFile } from './services/fileStorage';
import { loadModelFromFile, unloadModel } from './services/aiService';
import WelcomeScreen from './components/WelcomeScreen';
import AccessScreen from './components/AccessScreen';
import LoadingScreen from './components/LoadingScreen';
import ChatWorkspace from './components/ChatWorkspace';

export default function App() {
  const [status, setStatus] = useState('checking');
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
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
    const handle = await selectAndSaveFile();
    if (handle) {
      setFileHandle(handle);
      setFileName(handle.name);
      handleStartModel(handle);
    }
  };

  const handleStartModel = async (handle = fileHandle) => {
    try {
      const hasPermission = await verifyPermission(handle);
      if (!hasPermission) return alert('Доступ к файлу отклонен');
      
      setStatus('loading');
      await loadModelFromFile(handle, setProgress);
      setStatus('chat');
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки модели. Возможно, не хватает ОЗУ.');
      setStatus('welcome');
    }
  };

  const handleUnload = async () => {
    await unloadModel();
    setStatus('welcome');
    setFileHandle(null);
  };

  if (status === 'checking') return <div className="centered">Проверка базы данных...</div>;
  if (status === 'welcome') return <WelcomeScreen onSelect={handleSelectFile} />;
  if (status === 'access') return <AccessScreen fileName={fileName} onConfirm={() => handleStartModel()} onReset={handleSelectFile} />;
  if (status === 'loading') return <LoadingScreen progress={progress} fileName={fileName} />;
  if (status === 'chat') return <ChatWorkspace fileName={fileName} onUnload={handleUnload} />;
}
