// Sinal de presença: avisa o servidor que o app está aberto e quando a pessoa troca de aba.
const Presenca = {
  ligado: false, timer: null, ultimo: 0, ouvindo: false,

  enviar(evento, seg) {
    return Promise.resolve(Api.chamar('heartbeat', { evento: evento, seg: seg || 0 })).catch(function () {});
  },

  decorrido() {
    const s = Math.round((Date.now() - this.ultimo) / 1000);
    this.ultimo = Date.now();
    return Math.min(Math.max(s, 0), 60);
  },

  iniciar() {
    if (this.ligado) return;
    this.ligado = true;
    this.ultimo = Date.now();
    this.enviar('abriu');
    this.timer = setInterval(() => {
      if (document.hidden) { this.ultimo = Date.now(); this.enviar('fundo'); }
      else this.enviar('ping', this.decorrido());
    }, 30000);
    if (!this.ouvindo) {
      this.ouvindo = true;
      document.addEventListener('visibilitychange', () => {
        if (!this.ligado) return;
        if (document.hidden) this.enviar('oculto', this.decorrido());
        else { this.ultimo = Date.now(); this.enviar('visivel'); }
      });
    }
  },

  async parar() {
    if (!this.ligado) return;
    this.ligado = false;
    clearInterval(this.timer);
    await this.enviar('saiu', document.hidden ? 0 : this.decorrido());
  }
};
