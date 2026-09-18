import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../src/services/generationSettings', () => ({
  loadGenerationSettings: vi.fn(() => ({ temperature: 0.7, top_p: 1, max_tokens: 512 })),
  resetGenerationSettings: vi.fn(() => ({ temperature: 0.7, top_p: 1, max_tokens: 512 })),
  saveGenerationSettings: vi.fn(),
  validateGenerationSettings: vi.fn((value) => ({
    temperature: Number(value.temperature),
    top_p: Number(value.top_p),
    max_tokens: Number(value.max_tokens),
  })),
}));

vi.mock('../src/services/executionSettings', () => ({
  loadExecutionSettings: vi.fn(() => ({ n_gpu_layers: -1 })),
  resetExecutionSettings: vi.fn(() => ({ n_gpu_layers: -1 })),
  saveExecutionSettings: vi.fn(),
  validateExecutionSettings: vi.fn((value) => ({ n_gpu_layers: Number(value.n_gpu_layers) })),
}));

vi.mock('../src/components/HuggingFaceModelSearch', () => ({
  default: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect?.({ id: 'org/model' })}>Mock HF search</button>
  ),
}));

import GenerationSettings from '../src/components/GenerationSettings.jsx';
import ExecutionSettings from '../src/components/ExecutionSettings.jsx';
import HFModelPicker from '../src/components/HFModelPicker.jsx';
import WelcomeScreen from '../src/components/WelcomeScreen.jsx';
import * as generationSettings from '../src/services/generationSettings';

describe('settings and model selection components', () => {
  beforeEach(() => vi.clearAllMocks());

  it('edits and persists generation settings', async () => {
    render(<GenerationSettings conversation={{ id: 'c1', systemPrompt: 'old' }} onConversationChange={vi.fn()} supported={{ temperature: true, top_p: true, max_tokens: true }} />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '1.2' } });
    fireEvent.change(sliders[1], { target: { value: '0.8' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1024' } });
    expect(screen.getByText('1.2')).toBeInTheDocument();
    expect(screen.getByText('0.8')).toBeInTheDocument();
    expect(screen.getByText('1024')).toBeInTheDocument();
  });

  it('saves the system prompt on blur and resets defaults', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<GenerationSettings conversation={{ id: 'c1', systemPrompt: 'old' }} onConversationChange={onChange} supported={{ temperature: false, top_p: false, max_tokens: false }} />);
    const prompt = screen.getByPlaceholderText('Опишите роль и правила для модели…');
    fireEvent.change(prompt, { target: { value: 'new prompt' } });
    fireEvent.blur(prompt);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: 'new prompt' })));
    expect(screen.getByText(/не поддерживаются/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Восстановить defaults' }));
  });

  it('does not save an unchanged prompt and disables fields when requested', () => {
    const onChange = vi.fn();
    render(<GenerationSettings conversation={{ id: 'c1', systemPrompt: 'same' }} onConversationChange={onChange} disabled supported={{ temperature: true, top_p: true, max_tokens: true }} />);
    fireEvent.blur(screen.getByDisplayValue('same'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('same')).toBeDisabled();
    expect(screen.getAllByRole('slider')[0]).toBeDisabled();
  });

  it('shows validation errors from generation settings', () => {
    render(<GenerationSettings conversation={{ id: 'c1', systemPrompt: '' }} onConversationChange={vi.fn()} supported={{ temperature: true, top_p: true, max_tokens: true }} />);
    generationSettings.validateGenerationSettings.mockImplementationOnce(() => { throw new Error('bad setting'); });
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '2' } });
    expect(screen.getByRole('alert')).toHaveTextContent('bad setting');
  });

  it('renders execution layer controls after runtime reports context', async () => {
    const runtime = {
      getContextInfo: vi.fn(() => ({ n_layer: 24 })),
      subscribe: vi.fn(() => vi.fn()),
    };
    render(<ExecutionSettings runtime={runtime} onApply={vi.fn()} />);
    expect(await screen.findByText(/24 \/ 24/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(screen.getByText('16', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('8', { selector: 'strong' })).toBeInTheDocument();
  });

  it('applies execution settings and handles apply failures', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    const runtime = { getContextInfo: () => ({ n_layer: 12 }), subscribe: () => vi.fn() };
    render(<ExecutionSettings runtime={runtime} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Применить и перезагрузить' }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ n_gpu_layers: -1 }));

    onApply.mockRejectedValueOnce(new Error('reload failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Применить и перезагрузить' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('reload failed'));
  });

  it('renders execution empty state and reset', () => {
    const runtime = { getContextInfo: () => ({}), subscribe: () => vi.fn() };
    render(<ExecutionSettings runtime={runtime} onApply={undefined} />);
    expect(screen.getByText(/появится после загрузки/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Применить и перезагрузить' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'По умолчанию' }));
  });

  it('opens and cancels the HF picker, then selects a model', async () => {
    const onSelect = vi.fn();
    render(<HFModelPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Выбрать другую модель/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock HF search' }));
    expect(onSelect).toHaveBeenCalledWith({ id: 'org/model' });
    fireEvent.click(screen.getByRole('button', { name: /Выбрать другую модель/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: /Выбрать другую модель/ })).toBeInTheDocument();
  });

  it('selects an HF model on the welcome screen and shows errors', async () => {
    render(<WelcomeScreen onSelect={vi.fn()} onHF={vi.fn()} error="load failed" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mock HF search' }));
    expect(await screen.findByRole('status')).toHaveTextContent('org/model');
    expect(screen.getByText('load failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать GGUF файл' }));
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Qwen3.8-2B (HF)' }));
  });
});
