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

const remainingConversation = makeConversation({ id: 'chat-3', title: 'Оставшийся чат' });

describe('ChatWorkspace local chat history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveConversationId.mockResolvedValue('chat-1');
    getConversation.mockImplementation(async (id) => {
      if (id === 'chat-3') return remainingConversation;
      return makeConversation();
    });
    listConversations.mockResolvedValue([makeConversation()]);
    createConversation.mockResolvedValue(makeConversation({ id: 'chat-2', title: 'Новый чат' }));
    renameConversation.mockImplementation(async (id, title) => makeConversation({ id, title }));
    deleteConversation.mockResolvedValue(remainingConversation);
    saveConversation.mockResolvedValue(undefined);
  });

  it('restores the active conversation and its messages', async () => {
    const conversation = makeConversation({
      messages: [{ id: 'm1', role: 'user', content: 'Привет', createdAt: 300 }],
    });
    getConversation.mockResolvedValue(conversation);

    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);

    expect(await screen.findByText('Привет')).toBeInTheDocument();
    expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0);
    expect(getActiveConversationId).toHaveBeenCalledOnce();
    expect(getConversation).toHaveBeenCalledWith('chat-1');
  });

  it('creates a new chat without reloading the page', async () => {
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }));

    await waitFor(() => expect(screen.getByText('Новый чат')).toBeInTheDocument());
    expect(createConversation).toHaveBeenCalledOnce();
  });

  it('renames the active chat', async () => {
    window.prompt = vi.fn().mockReturnValue('Переименованный чат');
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }));

    await waitFor(() => expect(screen.getByText('Переименованный чат')).toBeInTheDocument());
    expect(renameConversation).toHaveBeenCalledWith('chat-1', 'Переименованный чат');
  });

  it('deletes the active chat and switches to another chat', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(screen.getByText('Оставшийся чат')).toBeInTheDocument());
    expect(deleteConversation).toHaveBeenCalledWith('chat-1');
    expect(getConversation).toHaveBeenCalledWith('chat-3');
  });

  it('deletes an individual message and persists the updated conversation', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Удалить меня', createdAt: 300 },
        { id: 'm2', role: 'assistant', content: 'Останусь', createdAt: 301 },
      ],
    });
    getConversation.mockResolvedValue(conversation);

    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    expect(await screen.findByText('Удалить меня')).toBeInTheDocument();

    const messageDeleteButtons = screen.getAllByRole('button', { name: 'Удалить' });
    fireEvent.click(messageDeleteButtons[1]);

    await waitFor(() => expect(screen.queryByText('Удалить меня')).not.toBeInTheDocument());
    expect(screen.getByText('Останусь')).toBeInTheDocument();
    const saved = saveConversation.mock.calls.at(-1)[0];
    expect(saved.messages).toEqual([conversation.messages[1]]);
  });

  it('loads a user prompt into edit mode and drops the old branch', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Старый промт', createdAt: 300 },
        { id: 'm2', role: 'assistant', content: 'Старый ответ', createdAt: 301 },
      ],
    });
    getConversation.mockResolvedValue(conversation);

    render(<ChatWorkspace runtime={{ isLoaded: () => true }} fileName="model.gguf" onUnload={vi.fn()} />);
    expect(await screen.findByText('Старый промт')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));

    expect(screen.getByPlaceholderText('Измените сообщение…')).toHaveValue('Старый промт');
    expect(screen.getByText('Старый ответ')).toBeInTheDocument();
  });

  it('regenerates from an edited user prompt without keeping the old branch', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Старый промт', createdAt: 300 },
        { id: 'm2', role: 'assistant', content: 'Старый ответ', createdAt: 301 },
      ],
    });
    getConversation.mockResolvedValue(conversation);
    const runtime = {
      isLoaded: () => true,
      streamChat: vi.fn(async (_messages, onToken) => onToken('Новый ответ')),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Старый промт');
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));

    const input = screen.getByPlaceholderText('Измените сообщение…');
    fireEvent.change(input, { target: { value: 'Новый промт' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByText('Новый ответ')).toBeInTheDocument());
    expect(screen.queryByText('Старый ответ')).not.toBeInTheDocument();
    expect(runtime.streamChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Новый промт' }],
      expect.any(Function),
      expect.anything(),
    );
    const saved = saveConversation.mock.calls.map(([value]) => value);
    expect(saved[0].messages).toHaveLength(1);
    expect(saved[0].messages[0]).toMatchObject({ role: 'user', content: 'Новый промт' });
    expect(saved.at(-1).messages).toHaveLength(2);
    expect(saved.at(-1).messages[1]).toMatchObject({ role: 'assistant', content: 'Новый ответ' });
  });

  it('persists user and assistant messages', async () => {
    const runtime = {
      isLoaded: () => true,
      streamChat: vi.fn(async (_messages, onToken) => {
        onToken('Ответ');
      }),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0));

    const input = screen.getByPlaceholderText('Сообщение privateAI…');
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

  it('sends the complete existing conversation on the next turn', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Меня зовут Андрей.', createdAt: 300 },
        { id: 'm2', role: 'assistant', content: 'Приятно познакомиться, Андрей.', createdAt: 301 },
      ],
    });
    getConversation.mockResolvedValue(conversation);
    const runtime = {
      isLoaded: () => true,
      streamChat: vi.fn(async (_messages, onToken) => onToken('Вас зовут Андрей.')),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Меня зовут Андрей.');

    const input = screen.getByPlaceholderText('Сообщение privateAI…');
    fireEvent.change(input, { target: { value: 'Как меня зовут?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByText('Вас зовут Андрей.')).toBeInTheDocument());
    expect(runtime.streamChat).toHaveBeenCalledWith(
      [
        { role: 'user', content: 'Меня зовут Андрей.' },
        { role: 'assistant', content: 'Приятно познакомиться, Андрей.' },
        { role: 'user', content: 'Как меня зовут?' },
      ],
      expect.any(Function),
      expect.anything(),
    );
  });

  it('sends system prompt before the complete conversation history', async () => {
    const conversation = makeConversation({
      systemPrompt: 'Отвечай кратко.',
      messages: [
        { id: 'm1', role: 'user', content: 'Первый вопрос', createdAt: 300 },
        { id: 'm2', role: 'assistant', content: 'Первый ответ', createdAt: 301 },
      ],
    });
    getConversation.mockResolvedValue(conversation);
    const runtime = {
      isLoaded: () => true,
      streamChat: vi.fn(async (_messages, onToken) => onToken('Второй ответ')),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await screen.findByText('Первый вопрос');

    const input = screen.getByPlaceholderText('Сообщение privateAI…');
    fireEvent.change(input, { target: { value: 'Второй вопрос' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByText('Второй ответ')).toBeInTheDocument());
    expect(runtime.streamChat).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'Отвечай кратко.' },
        { role: 'user', content: 'Первый вопрос' },
        { role: 'assistant', content: 'Первый ответ' },
        { role: 'user', content: 'Второй вопрос' },
      ],
      expect.any(Function),
      expect.anything(),
    );
  });

  it('cancels generation and persists the partial assistant response', async () => {
    let rejectGeneration;
    const runtime = {
      isLoaded: () => true,
      cancelGeneration: vi.fn(() => rejectGeneration(new DOMException('Generation cancelled', 'AbortError'))),
      streamChat: vi.fn(async (_messages, onToken) => {
        onToken('Частичный ответ');
        await new Promise((_, reject) => { rejectGeneration = reject; });
      }),
    };

    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" onUnload={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Сохранённый чат').length).toBeGreaterThan(0));

    const input = screen.getByPlaceholderText('Сообщение privateAI…');
    fireEvent.change(input, { target: { value: 'Долгий вопрос' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Остановить генерацию' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Остановить генерацию' }));

    await waitFor(() => expect(screen.getByPlaceholderText('Сообщение privateAI…')).toBeInTheDocument());
    expect(runtime.cancelGeneration).toHaveBeenCalledOnce();
    const saved = saveConversation.mock.calls.map(([value]) => value);
    expect(saved.at(-1).messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Частичный ответ',
      generationStatus: 'cancelled',
    });
  });
});
