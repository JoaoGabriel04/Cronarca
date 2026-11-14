import { describe, expect, it } from 'vitest';
import { estadoProvedor } from '../lib/provedores';

describe('botões de Google e Discord no login', () => {
  it('sem resposta do servidor ainda: "conectando" (o backend pode estar acordando)', () => {
    expect(estadoProvedor(undefined, false, 'google')).toBe('conectando');
    expect(estadoProvedor(undefined, false, 'discord')).toBe('conectando');
  });

  it('passou do limite sem resposta: indisponível', () => {
    expect(estadoProvedor(undefined, true, 'google')).toBe('indisponivel');
  });

  it('com resposta: ligado ou indisponível conforme o servidor, mesmo depois do limite', () => {
    const dados = { google: true, discord: false };
    expect(estadoProvedor(dados, false, 'google')).toBe('ligado');
    expect(estadoProvedor(dados, false, 'discord')).toBe('indisponivel');
    expect(estadoProvedor(dados, true, 'google')).toBe('ligado');
  });
});
