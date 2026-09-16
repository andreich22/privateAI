import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HuggingFaceModelSearch from '../src/components/HuggingFaceModelSearch';
import { searchHuggingFaceModels } from '../src/services/huggingFaceModels';

vi.mock('../src/services/huggingFaceModels', () => ({
  searchHuggingFaceModels: vi.fn(),
}));

describe('HuggingFaceModelSearch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a visible HF picker button and focuses search when opened', () => {
    render(<HuggingFaceModelSearch />);

    expect(screen.getByRole('button', { name: 'Выбрать модель из HF' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Поиск моделей Hugging Face' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать модель из HF' }));

    const input = screen.getByRole('textbox', { name: 'Поиск моделей Hugging Face' });
    expect(input).toHaveFocus();
  });

  it('shows search results and selection', async () => {
    const model = {
      id: 'Qwen/Qwen3-8B', author: 'Qwen', downloads: 1000, likes: 10,
      pipelineTag: 'text-generation', lastModified: '2026-09-01T00:00:00.000Z',
      url: 'https://huggingface.co/Qwen/Qwen3-8B',
    };
    searchHuggingFaceModels.mockResolvedValue([model]);
    const onSelect = vi.fn();
    render(<HuggingFaceModelSearch onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать модель из HF' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск моделей Hugging Face' }), { target: { value: 'Qwen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));

    expect(await screen.findByText('Qwen/Qwen3-8B')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать' }));
    expect(onSelect).toHaveBeenCalledWith(model);
  });

  it('shows empty state', async () => {
    searchHuggingFaceModels.mockResolvedValue([]);
    render(<HuggingFaceModelSearch />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать модель из HF' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск моделей Hugging Face' }), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    await waitFor(() => expect(screen.getByText('Модели не найдены.')).toBeInTheDocument());
  });

  it('shows API errors', async () => {
    searchHuggingFaceModels.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));
    render(<HuggingFaceModelSearch />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать модель из HF' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск моделей Hugging Face' }), { target: { value: 'llama' } });
    fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hugging Face временно ограничил запросы');
  });
});
