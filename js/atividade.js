// Atividade (admin): quem está online, tempo na tela, entradas/saídas e o que fez no dia.
const Atividade = {
  dia: '', timer: null, detalhe: null,

  el(tag, classe, texto) { return Kanban.el(tag, classe, texto); },
  area() { return document.getElementById('conteudo'); },
  hoje() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  tempo(seg) {
    const m = Math.round(seg / 60);
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min';
  },

  async iniciar() {
    this.parar();
    if (!this.dia) this.dia = this.hoje();
    this.detalhe = null;
    await this.carregar();
    this.timer = setInterval(() => { if (!document.hidden && !this.detalhe) this.carregar(); }, 30000);
  },

  parar() { clearInterval(this.timer); this.timer = null; },

  async carregar() {
    const r = await Api.chamar('presenca', { dia: this.dia });
    if (!r.ok) { this.area().textContent = r.erro || 'Não foi possível carregar.'; return; }
    this.desenhar(r.linhas);
  },

  desenhar(linhas) {
    const area = this.area();
    area.replaceChildren();
    const barra = this.el('div', 'vs-caminho');
    barra.appendChild(this.el('strong', '', 'Atividade do dia '));
    const d = this.el('input'); d.type = 'date'; d.value = this.dia;
    d.addEventListener('change', () => { this.dia = d.value || this.hoje(); this.carregar(); });
    barra.appendChild(d);
    const at = this.el('button', 'vs-atualizar', 'Atualizar'); at.type = 'button';
    at.addEventListener('click', () => this.carregar());
    barra.appendChild(at);
    area.appendChild(barra);

    const ordem = { gerente: 0, usuario: 1, admin: 2 };
    linhas.sort(function (a, b) {
      const o = (ordem[a.perfil] === undefined ? 3 : ordem[a.perfil]) - (ordem[b.perfil] === undefined ? 3 : ordem[b.perfil]);
      return o || a.login.localeCompare(b.login);
    });

    const tb = this.el('table', 'pn-tabela');
    const cab = this.el('tr');
    ['Usuário', 'Perfil', 'Agora', 'Último acesso', 'Primeira / última atividade', 'Tempo na tela', 'Entradas', 'Saídas', '']
      .forEach((t) => cab.appendChild(this.el('th', '', t)));
    const th = this.el('thead'); th.appendChild(cab); tb.appendChild(th);
    const rot = { ativo: '● Online', fundo: '◐ Em outra aba', offline: '○ Offline' };
    const corpo = this.el('tbody');
    linhas.forEach((l) => {
      const tr = this.el('tr');
      tr.appendChild(this.el('td', '', l.login));
      tr.appendChild(this.el('td', '', l.perfil));
      tr.appendChild(this.el('td', 'at-' + l.estado, rot[l.estado] || l.estado));
      tr.appendChild(this.el('td', '', l.ultimoAcesso || '—'));
      tr.appendChild(this.el('td', '', l.primeira ? l.primeira + ' – ' + l.ultimaAtv : '—'));
      tr.appendChild(this.el('td', '', this.tempo(l.segundos)));
      tr.appendChild(this.el('td', '', String(l.entradas)));
      tr.appendChild(this.el('td', '', String(l.saidas)));
      const td = this.el('td');
      const b = this.el('button', 'pn-btn pn-sec', 'O que fez'); b.type = 'button';
      b.addEventListener('click', () => this.verAtividade(l.login));
      td.appendChild(b); tr.appendChild(td);
      corpo.appendChild(tr);
    });
    tb.appendChild(corpo);
    const rol = this.el('div', 'pn-rolagem'); rol.appendChild(tb);
    area.appendChild(rol);
    area.appendChild(this.el('p', 'at-nota',
      'Tempo na tela conta só enquanto a aba está visível. “Saídas” são as vezes que a pessoa trocou de aba ou minimizou. “Último acesso” é a última vez que abriu o app.'));
  },

  async verAtividade(login) {
    this.detalhe = login;
    const area = this.area();
    area.replaceChildren();
    const voltar = this.el('button', 'vs-link', '‹ Voltar'); voltar.type = 'button';
    voltar.addEventListener('click', () => { this.detalhe = null; this.carregar(); });
    area.append(voltar, this.el('h2', 'vs-titulo', login + ' em ' + this.dia.split('-').reverse().join('/')));
    const box = this.el('div', '', 'Carregando...');
    area.appendChild(box);
    const r = await Api.chamar('atividadeUsuario', { login: login, dia: this.dia });
    if (!r.ok) { box.textContent = r.erro || 'Não foi possível carregar.'; return; }
    if (!r.itens.length) { box.textContent = 'Nenhuma ação registrada neste dia.'; return; }
    const tb = this.el('table', 'pn-tabela');
    const h = this.el('tr'); r.cab.forEach((t) => h.appendChild(this.el('th', '', t)));
    tb.appendChild(h);
    r.itens.forEach((it) => { const tr = this.el('tr'); it.forEach((v) => tr.appendChild(this.el('td', '', v))); tb.appendChild(tr); });
    const rol = this.el('div', 'pn-rolagem'); rol.appendChild(tb);
    box.replaceChildren(rol);
  }
};
