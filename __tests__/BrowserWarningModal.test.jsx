import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BrowserWarningModal from '../src/components/BrowserWarningModal';

const TITLE = 'Приложение работает только в Chromium-браузерах';
const CONTINUE_LABEL = 'Продолжить';
const CHECKBOX_LABEL = 'Не показывать снова';

describe('BrowserWarningModal', () => {
  let onConfirm;

  beforeEach(() => {
    onConfirm = vi.fn();
  });

  it('renders an accessible dialog with static content', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(TITLE);
    expect(dialog).toHaveAttribute('aria-labelledby', 'browser-warning-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'browser-warning-text browser-warning-hint');
    expect(screen.getByText(/PrivateAI запускает модель прямо в браузере/)).toBeInTheDocument();
    expect(screen.getByText(/Откройте эту страницу в Chromium-браузере/)).toBeInTheDocument();
    expect(screen.getByLabelText(CHECKBOX_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: CONTINUE_LABEL })).toBeInTheDocument();
  });

  it('moves initial focus to the continue button', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: CONTINUE_LABEL })).toHaveFocus();
  });

  it('confirms without remembering when the checkbox is unchecked', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('confirms with remembering when the checkbox is checked', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);
    fireEvent.click(screen.getByLabelText(CHECKBOX_LABEL));
    expect(screen.getByLabelText(CHECKBOX_LABEL)).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: CONTINUE_LABEL }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('closes on Escape with the current checkbox state', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onConfirm).toHaveBeenCalledWith(false);

    onConfirm.mockClear();
    fireEvent.click(screen.getByLabelText(CHECKBOX_LABEL));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('does not close when the backdrop is clicked', () => {
    const { container } = render(<BrowserWarningModal onConfirm={onConfirm} />);
    fireEvent.click(container.querySelector('.browser-warning-backdrop'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps Tab focus inside the dialog', () => {
    render(<BrowserWarningModal onConfirm={onConfirm} />);
    const checkbox = screen.getByLabelText(CHECKBOX_LABEL);
    const button = screen.getByRole('button', { name: CONTINUE_LABEL });

    expect(button).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(checkbox).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(button).toHaveFocus();
  });

  it('returns focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<BrowserWarningModal onConfirm={onConfirm} />);
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
