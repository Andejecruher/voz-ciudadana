import { jest } from '@jest/globals';

// ...existing code...
/**
 * Configuración global de Jest para tests de integración y unit.
 *
 * - Silencia `console.error` en tests (evita ruido del errorHandler)
 *   pero mantiene errores reales visibles via jest.spyOn cuando se necesite.
 * - Provee helpers de aserción para el formato ApiResponse.
 */

// ── Silenciar logs del error handler en tests ─────────────────────────────────
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {
    // silenciado — usar jest.spyOn localmente si necesitás asegurar que se llama
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
