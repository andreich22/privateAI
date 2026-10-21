import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@gravity-ui/uikit';

export function renderWithProviders(ui) {
  return render(<ThemeProvider theme="dark" lang="ru">{ui}</ThemeProvider>);
}
