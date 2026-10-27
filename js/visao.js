// Visão geral (gerente/admin): status -> usuárias -> clientes.
const Visao = {
  dados: null, status: null, usuario: null,

  el(tag, classe, texto) { return Kanban.el(tag, classe, texto); },
  area() { return document.getElementById('conteudo'); },

  async iniciar(forcar) {
    this.area().textContent = 'Carregando...';
    this.status = null; this.usuario = null;
    const r = await Api.chamar('visaoResumo', forcar ? { forcar: true } : {});
    if (!r.ok) { this.area().textContent = r.erro || 'Não foi possível carregar.'; return; }
    this.dados = r;
    this.desenhar();
  },

  rotulo(s) { return Kanban.ROTULOS[s] || s; },

  caminho() {
    const nav = this.el('div', 'vs-caminho');
    const add = (texto, fn) => {
      const b = this.el('button', 'vs-link', texto); b.type = 'button';
      b.addEventListener('click', fn); nav.appendChild(b);
    };
    add('Visão geral', () => { this.status = null; this.usuario = null; this.desenhar(); });
    if (this.status) {
      nav.appendChild(this.el('span', '', ' › '));
      add(this.rotulo(this.status), () => { this.usuario = null; this.desenhar(); });
    }
    if (this.usuario) { nav.appendChild(this.el('span', '', ' › ')); nav.appendChild(this.el('strong', '', this.usuario)); }
    const at = this.el('button', 'vs-atualizar', 'Atualizar'); at.type = 'button';
    at.addEventListener('click', () => this.iniciar(true));
    nav.appendChild(at);
    return nav;
  },

  desenhar() {
    const area = this.area();
    area.replaceChildren();
    area.appendChild(this.caminho());
    if (!this.status) this.porStatus(area);
    else if (!this.usuario) this.porUsuario(area);
    else this.clientes(area);
  },

  porStatus(area) {
    const grade = this.el('div', 'vs-grade');
    this.dados.ordem.forEach((s) => {
      const b = this.el('button', 'vs-cartao vs-' + s); b.type = 'button';
      b.appendChild(this.el('span', 'vs-num', String(this.dados.totais[s] || 0)));
      b.appendChild(this.el('span', 'vs-rot', this.rotulo(s)));
      b.addEventListener('click', () => { this.status = s; this.desenhar(); });
      grade.appendChild(b);
    });
    area.appendChild(grade);
  },

  porUsuario(area) {
    area.appendChild(this.el('h2', 'vs-titulo', this.rotulo(this.status) + ': ' + (this.dados.totais[this.status] || 0) + ' no total'));
    const lista = Object.keys(this.dados.porUsuario).map((u) => ({ u: u, n: this.dados.porUsuario[u][this.status] || 0 }))
      .sort(function (a, b) { return b.n - a.n; });
    const tb = this.el('table', 'pn-tabela');
    lista.forEach((x) => {
      const tr = this.el('tr', x.n ? 'vs-clicavel' : 'vs-vazio');
      tr.appendChild(this.el('td', '', x.u));
      tr.appendChild(this.el('td', 'vs-n', String(x.n)));
      if (x.n) tr.addEventListener('click', () => { this.usuario = x.u; this.desenhar(); });
      tb.appendChild(tr);
    });
    area.appendChild(tb);
  },

  async clientes(area) {
    const box = this.el('div', 'vs-lista', 'Carregando...');
    area.appendChild(box);
    const r = await Api.chamar('visaoClientes', { login: this.usuario, status: this.status });
    if (!r.ok) { box.textContent = r.erro || 'Não foi possível carregar.'; return; }
    box.replaceChildren();
    if (!r.itens.length) { box.textContent = 'Nenhum cliente nesta coluna.'; return; }
    r.itens.forEach((c) => box.appendChild(this.cartaoCliente(c)));
  },

  cartaoCliente(c) {
    const b = this.el('div', 'kb-card');
    b.appendChild(this.el('strong', 'kb-razao', c.razao));
    if (c.fantasia) b.appendChild(this.el('div', 'kb-fantasia', c.fantasia));
    b.appendChild(this.el('div', 'kb-linha', (c.municipio || '') + ' - ' + (c.uf || '')));
    b.appendChild(this.el('div', 'kb-linha', 'Último embarque: ' + Kanban.dataBr(c.ultimaData) + ' (' + c.dias + ' dias)'));
    if (c.telefone) b.appendChild(this.el('div', 'kb-linha', 'Tel: ' + c.telefone));
    if (c.obs) b.appendChild(this.el('div', 'vs-obs', 'Obs: ' + c.obs));
    return b;
  }
};
