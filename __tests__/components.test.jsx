import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WelcomeScreen from '../src/components/WelcomeScreen.jsx';
import LoadingScreen from '../src/components/LoadingScreen.jsx';
import AccessScreen from '../src/components/AccessScreen.jsx';
import ChatWorkspace from '../src/components/ChatWorkspace.jsx';

function renderComponent(Component, props = {}) {
  return renderToStaticMarkup(React.createElement(Component, props));
}

describe('WelcomeScreen', () => {
  it('renders title', () => {
    const html = renderComponent(WelcomeScreen, { onSelect: () => {}, onHF: () => {} });
    expect(html).toContain('Локальный ИИ Чат');
  });

  it('renders 2 buttons', () => {
    const html = renderComponent(WelcomeScreen, { onSelect: () => {}, onHF: () => {} });
    const buttons = (html.match(/<button/g) || []).length;
    expect(buttons).toBe(2);
  });

  it('renders error message when provided', () => {
    const html = renderComponent(WelcomeScreen, { onSelect: () => {}, onHF: () => {}, error: 'Test error' });
    expect(html).toContain('Test error');
  });

  it('does not render error when not provided', () => {
    const html = renderComponent(WelcomeScreen, { onSelect: () => {}, onHF: () => {} });
    expect(html).not.toContain('Test error');
  });

  it('renders description text', () => {
    const html = renderComponent(WelcomeScreen, { onSelect: () => {}, onHF: () => {} });
    expect(html).toContain('GGUF');
  });
});

describe('LoadingScreen', () => {
  it('renders progress bar with correct width', () => {
    const html = renderComponent(LoadingScreen, { progress: 50, fileName: 'model.gguf' });
    expect(html).toContain('width:50%');
  });

  it('displays progress percentage text', () => {
    const html = renderComponent(LoadingScreen, { progress: 75, fileName: 'model.gguf' });
    expect(html).toContain('75%');
  });

  it('renders file name', () => {
    const html = renderComponent(LoadingScreen, { progress: 0, fileName: 'my-model.gguf' });
    expect(html).toContain('my-model.gguf');
  });

  it('renders error message when provided', () => {
    const html = renderComponent(LoadingScreen, { progress: 0, fileName: 'model.gguf', error: 'Load failed' });
    expect(html).toContain('Load failed');
  });

  it('updates progress bar width on different values', () => {
    const html1 = renderComponent(LoadingScreen, { progress: 0, fileName: 'model.gguf' });
    expect(html1).toContain('width:0%');

    const html2 = renderComponent(LoadingScreen, { progress: 100, fileName: 'model.gguf' });
    expect(html2).toContain('width:100%');
  });
});

describe('AccessScreen', () => {
  it('renders file name', () => {
    const html = renderComponent(AccessScreen, { fileName: 'test-model.gguf', onConfirm: () => {}, onReset: () => {}, onHF: () => {} });
    expect(html).toContain('test-model.gguf');
  });

  it('renders 3 buttons', () => {
    const html = renderComponent(AccessScreen, { fileName: 'model.gguf', onConfirm: () => {}, onReset: () => {}, onHF: () => {} });
    const buttons = (html.match(/<button/g) || []).length;
    expect(buttons).toBe(3);
  });

  it('renders error message when provided', () => {
    const html = renderComponent(AccessScreen, { fileName: 'model.gguf', onConfirm: () => {}, onReset: () => {}, onHF: () => {}, error: 'Permission denied' });
    expect(html).toContain('Permission denied');
  });
});

describe('ChatWorkspace', () => {
  it('renders input field', () => {
    const html = renderComponent(ChatWorkspace, { fileName: 'test-model.gguf', onUnload: () => {} });
    expect(html).toContain('input');
  });

  it('renders submit button', () => {
    const html = renderComponent(ChatWorkspace, { fileName: 'test-model.gguf', onUnload: () => {} });
    expect(html).toContain('Отправить');
  });

  it('renders unload button', () => {
    const html = renderComponent(ChatWorkspace, { fileName: 'test-model.gguf', onUnload: () => {} });
    expect(html).toContain('Выгрузить');
  });

  it('displays model name from fileName', () => {
    const html = renderComponent(ChatWorkspace, { fileName: 'path/to/test-model.gguf', onUnload: () => {} });
    expect(html).toContain('test-model.gguf');
  });
});
