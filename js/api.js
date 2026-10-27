// Toda chamada ao Apps Script passa por aqui.
// Content-Type text/plain evita o pré-voo de CORS.
// Mostra um pop-up "Carregando..." se a chamada demorar mais de meio segundo.
const Api = {
  // ações automáticas, que rodam sozinhas e não mostram o pop-up
  SILENCIOSAS: ['heartbeat', 'presenca'],
  ATRASO_MS: 500,
  _ativas: 0,
  _timer: null,

  _carregando(ligar) {
    if (ligar) {
      this._ativas++;
      if (this._ativas === 1) {
        this._timer = setTimeout(function () {
          let el = document.getElementById('carregando');
          if (!el) {
            el = document.createElement('div');
            el.id = 'carregando';
            el.innerHTML = '<div class="car-caixa"><div class="car-roda"></div>' +
                           '<div>Carregando...</div></div>';
            document.body.appendChild(el);
          }
          el.hidden = false;
        }, this.ATRASO_MS);
      }
    } else {
      this._ativas = Math.max(0, this._ativas - 1);
      if (this._ativas === 0) {
        clearTimeout(this._timer);
        const el = document.getElementById('carregando');
        if (el) el.hidden = true;
      }
    }
  },

  async chamar(acao, dados = {}, comToken = true) {
    const corpo = Object.assign({ acao: acao }, dados);
    if (comToken) corpo.token = Auth.token();
    const mostrar = this.SILENCIOSAS.indexOf(acao) < 0;
    if (mostrar) this._carregando(true);
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
    } finally {
      if (mostrar) this._carregando(false);
    }
  }
};
