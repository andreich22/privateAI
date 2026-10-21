import React from 'react';
import ReactDOM from 'react-dom/client';
import { configure, Lang, ThemeProvider } from '@gravity-ui/uikit';
import '@gravity-ui/aikit/themes/common';
import '@gravity-ui/aikit/themes/dark';
import 'highlight.js/styles/github-dark.css';
import App from './App.jsx';
import './index.css';

configure({ lang: Lang.Ru });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme="dark" lang={Lang.Ru}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
