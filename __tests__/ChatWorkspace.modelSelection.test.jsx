import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWorkspace from '../src/components/ChatWorkspace';
import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('../src/services/chatStorage', () => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getActiveConversationId: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  renameConversation: vi.fn(),
  saveConversation: vi.fn(),
}));

vi.mock('../src/services/generationSettings', () => ({
  loadGenerationSettings: vi.fn(() => ({ temperature: 0.7, top_p: 1, max_tokens: 512 })),
}));

import {
  createConversation,
  getActiveConversationId,
  getConversation,
  listConversations,
  saveConversation,
} from '../src/services/chatStorage';

const conversation = {
  id: 'chat-1',
  title: 'Чат без модели',
  createdAt: 100,
  updatedAt: 200,
  messages: [],
};

function renderWorkspace(runtime, props = {}) {
  return renderWithProviders(
    <ChatWorkspace
      runtime={runtime}
      fileName=""
      onUnload={vi.fn()}
      onSelectModel={vi.fn()}
      onLoadFromHF={vi.fn()}
      {...props}
    />,
  );
}

describe('ChatWorkspace without a selected model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveConversationId.mockResolvedValue('chat-1');
    getConversation.mockResolvedValue(conversation);
    listConversations.mockResolvedValue([conversation]);
    createConversation.mockResolvedValue(conversation);
    saveConversation.mockResolvedValue(undefined);
  });

  it('shows that no model is selected and offers model actions', async () => {
    const runtime = { isLoaded: () => false };
    const onSelectModel = vi.fn();
    const onLoadFromHF = vi.fn();

    renderWorkspace(runtime, { onSelectModel, onLoadFromHF });
    await waitFor(() => expect(screen.getAllByText('Чат без модели').length).toBeGreaterThan(0));

    expect(screen.getAllByText('Модель не выбрана').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать GGUF файл' }));
    fireEvent.click(screen.getByRole('button', { name: 'Скачать модель (HF)' }));

    expect(onSelectModel).toHaveBeenCalledOnce();
    expect(onLoadFromHF).toHaveBeenCalledOnce();
  });

  it('does not send a message and explains that a model must be selected', async () => {
    const runtime = { isLoaded: () => false, streamChat: vi.fn() };

    renderWorkspace(runtime);
    await waitFor(() => expect(screen.getAllByText('Чат без модели').length).toBeGreaterThan(0));

    const input = screen.getByPlaceholderText('Сообщение privateAI…');
    fireEvent.change(input, { target: { value: 'Привет' } });
    fireEvent.click(screen.getByTestId('private-ai-submit-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Модель не выбрана');
    expect(runtime.streamChat).not.toHaveBeenCalled();
    expect(saveConversation).not.toHaveBeenCalled();
  });

  it('disables unloading when no model is loaded', async () => {
    renderWorkspace({ isLoaded: () => false });
    await waitFor(() => expect(screen.getAllByText('Чат без модели').length).toBeGreaterThan(0));

    expect(screen.getByRole('button', { name: 'Выгрузить' })).toBeDisabled();
  });

  it('hides the missing-model notice when the model is loaded', async () => {
    renderWorkspace({ isLoaded: () => true }, { fileName: 'path/to/model.gguf' });
    await waitFor(() => expect(screen.getAllByText('Чат без модели').length).toBeGreaterThan(0));

    expect(screen.queryByText('Модель не выбрана')).not.toBeInTheDocument();
    expect(screen.getByText('Локально · model.gguf')).toBeInTheDocument();
  });
});
