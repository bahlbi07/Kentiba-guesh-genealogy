import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';

// Ensure structuredClone is available in jsdom if needed
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val: any) => JSON.parse(JSON.stringify(val));
}
