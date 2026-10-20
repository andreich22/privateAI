import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';

const STORAGE_KEY = 'privateai.browserWarning.dismissed';
const CHECKBOX_LABEL = 'Не показывать снова';
const CONTINUE_LABEL = 'Продолжить';

function isNonChromiumEnvironment() {
  return !window.navigator.userAgent.includes('Chrome');
}

describe('App browser warning', () => {
  beforeEach(() => {
    localStorage.clear();
    if (!isNonChromiumEnvironment()) {
      throw new Error('Тестовые среды обязаны использовать не-Chromium UA, иначе модалка не появится');
    }
  });

  it('shows the modal on the checking screen and keeps it across screen changes', async () => {
    render(<App />);

    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('Проверка среды...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('persists the dismissal flag when the checkbox is checked', async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText(CHECKBOX_LABEL));
    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('clears a stale dismissal flag when the modal is confirmed without the checkbox', () => {
    localStorage.setItem(STORAGE_KEY, '0');
    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not store the flag when the checkbox is checked and then unchecked', () => {
    render(<App />);
    const checkbox = screen.getByLabelText(CHECKBOX_LABEL);

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('hides the modal when the flag is already set', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape without storing the flag', () => {
    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps the flag across reloads and hides the modal on the next load', async () => {
    const first = render(<App />);
    fireEvent.click(screen.getByLabelText(CHECKBOX_LABEL));
    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    first.unmount();

    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-shows the modal on the next load when the checkbox was unchecked', () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    first.unmount();

    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
