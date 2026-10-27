// Tela do kanban: colunas, cards, mover entre colunas e observação.
// Usa as ações 'kanban' e 'atualizarCard' da API.
const Kanban = {
  ROTULOS: {
    A_CHAMAR: 'A chamar', EM_CONTATO: 'Em contato', RETORNAR: 'Retornar',
    PEDIDO_FEITO: 'Pedido feito', SEM_INTERESSE: 'Sem interesse'
  },
  dados: null,
  filtro: '',
  quadro: null,
  alvo: '',        // usuária escolhida (só gerente/admin)
  usuarios: null,  // lista de usuárias para o seletor

  // ---------- utilitários ----------
  el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  },

  dataBr(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  },

  digitos(tel) { return String(tel || '').replace(/\D/g, ''); },

  aviso(msg) {
    let a = document.getElementById('kb-aviso');
    if (!a) { a = this.el('div', 'kb-aviso'); a.id = 'kb-aviso'; document.body.appendChild(a); }
    a.textContent = msg;
    a.hidden = false;
    clearTimeout(this._t);
    this._t = setTimeout(function () { a.hidden = true; }, 4000);
  },

  // ---------- carregar ----------
  ehGestor() {
    const a = String((App.perfil && App.perfil.acesso) || '').toUpperCase();
    return a === 'ADMIN' || a === 'GERENTE';
  },

  async carregarUsuarios() {
    const r = await Api.chamar('usuarios');
    this.usuarios = r.ok
      ? r.usuarios.filter(function (u) { return u.perfil === 'usuario' && u.ativo; })
          .map(function (u) { return u.login; })
      : [];
  },

  resetar() { this.dados = null; this.filtro = ''; this.alvo = ''; this.usuarios = null; },

  async iniciar() {
    const area = document.getElementById('conteudo');
    area.textContent = 'Carregando...';
    if (this.ehGestor() && this.usuarios === null) await this.carregarUsuarios();
    const r = await Api.chamar('kanban', this.alvo ? { verUsuario: this.alvo } : {});
    if (!r.ok) {
      this.alvo = '';
      area.textContent = r.erro || 'Não foi possível carregar o kanban.';
      return;
    }
    this.dados = r;
    this.desenhar();
  },

  // ---------- desenho ----------
  desenhar() {
    const area = document.getElementById('conteudo');
    area.replaceChildren();

    const barra = this.el('div', 'kb-barra');
    const busca = this.el('input', 'kb-busca');
    busca.placeholder = 'Buscar cliente, CNPJ ou cidade';
    busca.value = this.filtro;
    busca.addEventListener('input', () => { this.filtro = busca.value; this.desenharColunas(); });
    const recarregar = this.el('button', 'kb-recarregar', 'Atualizar');
    recarregar.type = 'button';
    recarregar.addEventListener('click', () => this.iniciar());
    if (this.ehGestor() && this.usuarios && this.usuarios.length) {
      const sel = this.el('select', 'kb-usuario');
      const o0 = this.el('option', '', 'Visão padrão');
      o0.value = '';
      sel.appendChild(o0);
      this.usuarios.forEach((u) => {
        const o = this.el('option', '', 'Quadro de ' + u);
        o.value = u;
        sel.appendChild(o);
      });
      sel.value = this.alvo;
      sel.addEventListener('change', () => { this.alvo = sel.value; this.iniciar(); });
      barra.appendChild(sel);
    }
    barra.append(busca, recarregar);
    barra.appendChild(this.el('span', 'kb-total', 'Total: ' + this.dados.total));

    this.quadro = this.el('div', 'kb-quadro');
    area.appendChild(barra);
    if (typeof this.dados.aviso === 'string' && this.dados.aviso) {
      area.appendChild(this.el('p', 'kb-aviso-topo', this.dados.aviso));
    }
    area.appendChild(this.quadro);
    this.desenharColunas();
  },

  desenharColunas() {
    const termo = this.filtro.trim().toLowerCase();
    this.quadro.replaceChildren();
    this.dados.ordem.forEach((status) => {
      const todos = this.dados.colunas[status] || [];
      const lista = todos.filter(function (c) {
        if (!termo) return true;
        return [c.razao, c.fantasia, c.cnpj, c.municipio, c.uf].join(' ').toLowerCase().indexOf(termo) >= 0;
      });
      const col = this.el('div', 'kb-coluna kb-' + status);
      col.appendChild(this.el('h2', 'kb-titulo', (this.ROTULOS[status] || status) + ' (' + lista.length + ')'));
      const corpo = this.el('div', 'kb-corpo');
      lista.forEach((c) => corpo.appendChild(this.card(c)));
      col.appendChild(corpo);
      this.quadro.appendChild(col);
    });
  },

  card(c) {
    const box = this.el('div', 'kb-card');
    box.appendChild(this.el('strong', 'kb-razao', c.razao));
    if (c.fantasia) box.appendChild(this.el('div', 'kb-fantasia', c.fantasia));
    box.appendChild(this.el('div', 'kb-linha', (c.municipio || '') + ' - ' + (c.uf || '')));
    box.appendChild(this.el('div', 'kb-linha',
      'Último embarque: ' + this.dataBr(c.ultimaData) + ' (' + c.dias + ' dias) · ' +
      c.qtdPedidos + (Number(c.qtdPedidos) === 1 ? ' pedido' : ' pedidos')));
    if (c.usuario) box.appendChild(this.el('div', 'kb-linha kb-dono', 'Atendido por: ' + c.usuario));

    // contato
    const tel = this.digitos(c.telefone);
    const acoes = this.el('div', 'kb-acoes');
    if (tel.length >= 8) {
      const ligar = this.el('a', 'kb-link', 'Ligar');
      ligar.href = 'tel:' + tel;
      acoes.appendChild(ligar);
    }
    if (tel.length >= 10) {
      const wa = this.el('a', 'kb-link kb-wa', 'WhatsApp');
      wa.href = 'https://wa.me/' + (tel.indexOf('55') === 0 && tel.length >= 12 ? tel : '55' + tel);
      wa.target = '_blank';
      wa.rel = 'noopener';
      acoes.appendChild(wa);
    }
    if (c.telefone) acoes.appendChild(this.el('span', 'kb-tel', c.telefone));
    box.appendChild(acoes);

    // mover
    const sel = this.el('select', 'kb-status');
    this.dados.ordem.forEach((s) => {
      const o = this.el('option', '', this.ROTULOS[s] || s);
      o.value = s;
      if (s === c.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => this.mover(c, sel.value, sel));
    box.appendChild(sel);

    // observação
    const det = this.el('details', 'kb-obs');
    det.open = !!c.obs;
    det.appendChild(this.el('summary', '', c.obs ? 'Observação ✎' : 'Observação'));
    const txt = this.el('textarea', 'kb-texto');
    txt.rows = 3;
    txt.value = c.obs || '';
    const salvar = this.el('button', 'kb-salvar', 'Salvar');
    salvar.type = 'button';
    salvar.addEventListener('click', () => this.salvarObs(c, txt.value, salvar));
    det.append(txt, salvar);
    box.appendChild(det);
    return box;
  },

  // ---------- ações ----------
  async mover(c, novo, sel) {
    sel.disabled = true;
    const r = await Api.chamar('atualizarCard', { cnpj: c.cnpj, status: novo, obs: c.obs || '' });
    if (!r.ok) {
      this.aviso(r.erro || 'Não foi possível mover o card.');
      this.desenharColunas();
      return;
    }
    const origem = this.dados.colunas[c.status] || [];
    const i = origem.indexOf(c);
    if (i >= 0) origem.splice(i, 1);
    c.status = novo;
    if (!this.dados.colunas[novo]) this.dados.colunas[novo] = [];
    this.dados.colunas[novo].push(c);
    this.dados.colunas[novo].sort(function (a, b) { return b.dias - a.dias; });
    this.desenharColunas();
  },

  async salvarObs(c, texto, btn) {
    btn.disabled = true;
    const r = await Api.chamar('atualizarCard', { cnpj: c.cnpj, status: c.status, obs: texto });
    btn.disabled = false;
    if (!r.ok) { this.aviso(r.erro || 'Não foi possível salvar a observação.'); return; }
    c.obs = texto;
    btn.textContent = 'Salvo ✓';
    setTimeout(function () { btn.textContent = 'Salvar'; }, 1500);
  }
};
