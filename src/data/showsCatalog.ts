import type { ShowEvent } from '../types/models';

// Catálogo estático mantido vazio em produção: todos os shows vêm em tempo real
// da API oficial da Setlist.fm + registros criados manualmente pelo usuário.
export const SHOWS_CATALOG: ShowEvent[] = [];
