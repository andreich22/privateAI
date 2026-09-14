import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWorkspace from '../src/components/ChatWorkspace';
import {
  createConversation,
  deleteConversation,
  getActiveConversationId,
  getConversation,
  listConversations,
  renameConversation,
  saveConversation,
} from '../src/services/chatStorage';

vi.mock('../src/services/chatStorage', () => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getActiveConversationId: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  renameConversation: vi.fn(),
  saveConversation: vi.fn(),
}));

const makeConversation = (overrides = {}) => ({
  id: 'chat-1',
  title: 'Сохранённый чат',
  createdAt: 100,
  updatedAt: 200,
  messages: [],
  ...overrides,
});

describe('ChatWorkspace local chat history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveConversationId.mockResolvedValue('chat-1');
    getConversation.mockResolvedValue(makeConversation());
    listConversations.mockResolvedValue([makeConversation()]);
    createConversation.mockResolvedValue(makeConversation({ id: 'chat-2', title: 'Новый чат' }));
    renameConversation.mockImplementation(async (id, title) => makeConversation({ id, title }));
    deleteConversation.mockResolvedValue(makeConversation({ id: 'chat-3', title: 'Оставшийся чат' }));
    saveConversation.mockResolvedValue(undefined);
  });

  it('restores the active conversation and its messages', async () => {
    const conversation = makeConversation({
      messages: [{ id: 'm1', role: 'user', content: 'Привет', createdAt: 300 }],
    });
    getConversation.mockResolvedValue(conversation);

    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);

    expect(await screen.findByText('Привет')).toBeInTheDocument();
    expect(screen.getByText('Сохранённый чат')).toBeInTheDocument();
    expect(getActiveConversationId).toHaveBeenCalledOnce();
    expect(getConversation).toHaveBeenCalledWith('chat-1');
  });

  it('creates a new chat without reloading the page', async () => {
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Сохранённый чат');

    fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }));

    await waitFor(() => expect(screen.getByText('Новый чат')).toBeInTheDocument());
    expect(createConversation).toHaveBeenCalledOnce();
  });

  it('renames the active chat', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Переименованный чат');
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Сохранённый чат');

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }));

    await waitFor(() => expect(screen.getByText('Переименованный чат')).toBeInTheDocument());
    expect(renameConversation).toHaveBeenCalledWith('chat-1', 'Переименованный чат');
  });

  it('deletes the active chat and switches to another chat', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Сохранённый чат');

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(screen.getByText('Оставшийся чат')).toBeInTheDocument());
    expect(deleteConversation).toHaveBeenCalledWith('chat-1');
    expect(getConversation).toHaveBeenCalledWith('chat-3');
  });

  it('persists user and assistant messages', async () => {
    const runtime = {
      isLoaded: () => true,
      streamChat: vi.fn(async (_messages, onToken) => {
        onToken('Ответ');
      }),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Сохранённый чат');

    const input = screen.getByPlaceholderText('1+1 = ?');
    fireEvent.change(input, { target: { value: 'Вопрос' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByText('Ответ')).toBeInTheDocument());
    expect(saveConversation).toHaveBeenCalledTimes(2);

    const saved = saveConversation.mock.calls.map(([value]) => value);
    expect(saved[0].messages).toHaveLength(1);
    expect(saved[0].messages[0]).toMatchObject({ role: 'user', content: 'Вопрос' });
    expect(saved[1].messages).toHaveLength(2);
    expect(saved[1].messages[1]).toMatchObject({ role: 'assistant', content: 'Ответ' });
  });
});
