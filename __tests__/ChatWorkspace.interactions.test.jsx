import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatWorkspace from '../src/components/ChatWorkspace.jsx';

const storage = {
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getActiveConversationId: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  renameConversation: vi.fn(),
  saveConversation: vi.fn(),
};

vi.mock('../src/services/chatStorage', () => ({
  createConversation: vi.fn(), deleteConversation: vi.fn(), getActiveConversationId: vi.fn(),
  getConversation: vi.fn(), listConversations: vi.fn(), renameConversation: vi.fn(), saveConversation: vi.fn(),
}));
vi.mock('../src/services/generationSettings', () => ({
  loadGenerationSettings: vi.fn(() => ({ temperature: 0.7, top_p: 1, max_tokens: 512 })),
}));

vi.mock('../src/components/GenerationSettings', () => ({
  default: ({ conversation, onConversationChange }) => (
    <button type="button" onClick={() => onConversationChange({ ...conversation, systemPrompt: 'Updated' })}>
      Mock generation settings
    </button>
  ),
}));

vi.mock('../src/components/ExecutionSettings', () => ({
  default: () => <div>Mock execution settings</div>,
}));

function conversation(overrides = {}) {
  return {
    id: 'c1',
    title: 'Test chat',
    systemPrompt: '',
    createdAt: 1,
    updatedAt: 2,
    messages: [],
    ...overrides,
  };
}

function createRuntime(overrides = {}) {
  return {
    isLoaded: vi.fn(() => true),
    streamChat: vi.fn(async (_messages, onToken) => {
      onToken('hello');
      return { text: 'hello', usage: { cached: 1, input: 2, output: 3, total: 5 } };
    }),
    cancelGeneration: vi.fn(),
    getGenerationCapabilities: vi.fn(() => ({ temperature: true, top_p: true, max_tokens: true })),
    ...overrides,
  };
}

describe('ChatWorkspace interactions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mocked = await import('../src/services/chatStorage');
    Object.assign(storage, mocked);
    const initial = conversation();
    storage.getActiveConversationId.mockResolvedValue('c1');
    storage.getConversation.mockResolvedValue(initial);
    storage.listConversations.mockResolvedValue([initial]);
    storage.createConversation.mockResolvedValue(conversation({ id: 'c2', title: 'Новый чат' }));
    storage.saveConversation.mockResolvedValue(true);
    storage.renameConversation.mockResolvedValue(conversation({ title: 'Renamed', updatedAt: 3 }));
    storage.deleteConversation.mockResolvedValue(null);
    window.prompt = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it('restores the active conversation from storage', async () => {
    render(<ChatWorkspace runtime={createRuntime()} fileName="models/test.gguf" onUnload={vi.fn()} />);

    expect(await screen.findAllByText('Test chat')).toHaveLength(2);
    expect(screen.getByText('Локально · test.gguf')).toBeInTheDocument();
    expect(storage.getActiveConversationId).toHaveBeenCalled();
    expect(storage.getConversation).toHaveBeenCalledWith('c1');
  });

  it('creates a new chat and refreshes the sidebar', async () => {
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Новый чат' }));

    await waitFor(() => expect(storage.createConversation).toHaveBeenCalled());
    expect((await screen.findAllByText('Новый чат')).length).toBeGreaterThanOrEqual(1);
  });

  it('renames the active conversation', async () => {
    window.prompt.mockReturnValue('Renamed');
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }));

    await waitFor(() => expect(storage.renameConversation).toHaveBeenCalledWith('c1', 'Renamed'));
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
  });

  it('ignores rename when the prompt is cancelled', async () => {
    window.prompt.mockReturnValue(null);
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }));
    await waitFor(() => expect(window.prompt).toHaveBeenCalled());
    expect(storage.renameConversation).not.toHaveBeenCalled();
  });

  it('deletes the active conversation and creates a replacement when none remain', async () => {
    storage.deleteConversation.mockResolvedValue(null);
    storage.createConversation.mockResolvedValue(conversation({ id: 'c3', title: 'Replacement' }));
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(storage.deleteConversation).toHaveBeenCalledWith('c1'));
    expect(storage.createConversation).toHaveBeenCalled();
    expect(await screen.findByText('Replacement')).toBeInTheDocument();
  });

  it('cancels deletion when confirmation is declined', async () => {
    window.confirm.mockReturnValueOnce(false);
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(storage.deleteConversation).not.toHaveBeenCalled();
  });

  it('sends a message, streams the assistant reply and stores token usage', async () => {
    const runtime = createRuntime();
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    const input = screen.getByRole('textbox', { name: 'Сообщение' });
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(runtime.streamChat).toHaveBeenCalled());
    expect(runtime.streamChat.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
    await waitFor(() => expect(screen.getByText('Кэш 1')).toBeInTheDocument());
    expect(storage.saveConversation).toHaveBeenCalled();
  });

  it('includes a trimmed system prompt in the runtime message history', async () => {
    storage.getConversation.mockResolvedValue(conversation({ systemPrompt: '  Be concise  ' }));
    const runtime = createRuntime();
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(runtime.streamChat).toHaveBeenCalled());
    expect(runtime.streamChat.mock.calls[0][0][0]).toEqual({ role: 'system', content: 'Be concise' });
  });

  it('edits an existing user message and sends the truncated history', async () => {
    const initial = conversation({
      messages: [
        { id: 'm1', role: 'user', content: 'old prompt', createdAt: 1 },
        { id: 'm2', role: 'assistant', content: 'old answer', createdAt: 2 },
      ],
    });
    storage.getConversation.mockResolvedValue(initial);
    const runtime = createRuntime();
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findByText('old prompt');

    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    const input = screen.getByRole('textbox', { name: 'Сообщение' });
    expect(input).toHaveValue('old prompt');
    fireEvent.change(input, { target: { value: 'new prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(runtime.streamChat).toHaveBeenCalled());
    expect(runtime.streamChat.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'new prompt' },
    ]);
  });

  it('deletes a message after confirmation', async () => {
    const initial = conversation({
      messages: [{ id: 'm1', role: 'user', content: 'remove me', createdAt: 1 }],
    });
    storage.getConversation.mockResolvedValue(initial);
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" />);
    await screen.findByText('remove me');

    const deleteButtons = screen.getAllByRole('button', { name: 'Удалить' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(storage.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: [],
    })));
  });

  it('cancels an active generation and preserves partial assistant text', async () => {
    let resolveGeneration;
    const runtime = createRuntime({
      streamChat: vi.fn((_messages, onToken) => {
        onToken('partial');
        return new Promise((resolve) => { resolveGeneration = resolve; });
      }),
    });
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByRole('button', { name: 'Остановить генерацию' });

    fireEvent.click(screen.getByRole('button', { name: 'Остановить генерацию' }));
    expect(runtime.cancelGeneration).toHaveBeenCalled();

    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    resolveGeneration(Promise.reject(abort));
    await waitFor(() => expect(storage.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({
        content: 'partial',
        generationStatus: 'cancelled',
      })]),
    })));
  });

  it('stores a readable assistant error when generation fails', async () => {
    const runtime = createRuntime({
      streamChat: vi.fn().mockRejectedValue(new Error('boom')),
    });
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(storage.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({
        content: '[Ошибка чата: boom]',
      })]),
    })));
  });

  it('prevents sending when the runtime is not loaded', async () => {
    const runtime = createRuntime({ isLoaded: vi.fn(() => false) });
    render(<ChatWorkspace runtime={runtime} fileName="model.gguf" />);
    await screen.findAllByText('Test chat');

    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(runtime.streamChat).not.toHaveBeenCalled();
  });

  it('calls unload when generation is idle', async () => {
    const onUnload = vi.fn().mockResolvedValue(undefined);
    render(<ChatWorkspace runtime={createRuntime()} fileName="model.gguf" onUnload={onUnload} />);
    await screen.findAllByText('Test chat');

    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }));
    await waitFor(() => expect(onUnload).toHaveBeenCalled());
  });
});
