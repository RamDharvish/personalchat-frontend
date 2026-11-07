import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { useChatStore } from './store/useChatStore.js';

if (typeof window !== 'undefined') {
  (window as any).__chatStore = useChatStore;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
