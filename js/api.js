// Toda chamada ao Apps Script passa por aqui.
// Content-Type text/plain evita o pré-voo de CORS.
const Api = {
  async chamar(acao, dados = {}, comToken = true) {
    const corpo = Object.assign({ acao: acao }, dados);
    if (comToken) corpo.token = Auth.token();
    try {
      const r = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo)
      });
      const j = await r.json();
      if (j.sessaoExpirada) { Auth.limpar(); App.mostrar('login'); }
      return j;
    } catch (e) {
      return { ok: false, erro: 'Sem conexão com o servidor.' };
    }
  }
};
