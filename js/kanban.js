// Tela do kanban: colunas, cards, popup do cliente, mover entre colunas e observação.
// Usa as ações 'kanban', 'atualizarCard' e 'historico' da API.
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
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
  },

  digitos(tel) { return String(tel || '').replace(/\D/g, ''); },

  cnpjBr(v) {
    const d = this.digitos(v);
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return String(v || '');
  },

  moeda(n) {
    return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  // dias nulos (cliente sem pedido) vão por último
  porDias(a, b) {
    const x = a.dias == null ? Infinity : a.dias;
    const y = b.dias == null ? Infinity : b.dias;
    return x === y ? 0 : (x < y ? -1 : 1);
  },

  textoEntrega(c) {
    return c.ultimaData
      ? 'Última entrega: ' + this.dataBr(c.ultimaData) + ' (' + c.dias + ' dias)'
      : 'Sem pedido registrado';
  },

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

  resetar() { this.fecharDetalhe(); this.dados = null; this.filtro = ''; this.alvo = ''; this.usuarios = null; },

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
    box.style.cursor = 'pointer';
    box.appendChild(this.el('strong', 'kb-razao', c.razao));
    if (c.fantasia) box.appendChild(this.el('div', 'kb-fantasia', c.fantasia));
    box.appendChild(this.el('div', 'kb-linha', (c.municipio || '') + ' - ' + (c.uf || '')));
    box.appendChild(this.el('div', 'kb-linha', this.textoEntrega(c)));
    if (c.usuario) box.appendChild(this.el('div', 'kb-linha kb-dono', 'Atendido por: ' + c.usuario));

    // seletor de status (criado antes para o botão WhatsApp poder usá-lo)
    const sel = this.el('select', 'kb-status');
    this.dados.ordem.forEach((s) => {
      const o = this.el('option', '', this.ROTULOS[s] || s);
      o.value = s;
      if (s === c.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => this.mover(c, sel.value, sel));

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
      // ao clicar no WhatsApp, quem está em "A chamar" passa para "Em contato"
      wa.addEventListener('click', () => {
        if (c.status === 'A_CHAMAR') this.mover(c, 'EM_CONTATO', sel);
      });
      acoes.appendChild(wa);
    }
    if (c.telefone) acoes.appendChild(this.el('span', 'kb-tel', c.telefone));
    box.appendChild(acoes);

    // mover
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

    // clicar no card abre o popup (menos nos botões, links, seletor e observação)
    box.addEventListener('click', (e) => {
      if (e.target.closest('a, button, select, textarea, details')) return;
      this.abrirDetalhe(c);
    });
    return box;
  },

  // ---------- popup do cliente ----------
  estiloModal() {
    if (document.getElementById('kb-modal-css')) return;
    const s = document.createElement('style');
    s.id = 'kb-modal-css';
    s.textContent =
      '.kb-modal-fundo{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:12px}' +
      '.kb-modal{background:#fff;border-radius:10px;max-width:820px;width:100%;max-height:90vh;overflow:auto;padding:18px 20px;box-shadow:0 10px 30px rgba(0,0,0,.3);position:relative}' +
      '.kb-modal-fechar{position:absolute;top:8px;right:12px;border:0;background:none;font-size:26px;cursor:pointer;line-height:1}' +
      '.kb-modal h3{margin:0 28px 2px 0;font-size:18px}' +
      '.kb-modal-sub{color:#555;margin:0 0 12px}' +
      '.kb-modal-dados{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;margin-bottom:14px}' +
      '.kb-modal-dados small{display:block;color:#777;font-size:11px;text-transform:uppercase}' +
      '.kb-modal h4{margin:14px 0 6px;font-size:15px}' +
      '.kb-hist{width:100%;border-collapse:collapse;font-size:13px}' +
      '.kb-hist th,.kb-hist td{text-align:left;padding:5px 8px;border-bottom:1px solid #e5e5e5}' +
      '.kb-hist th{background:#f4f4f4;position:sticky;top:0}' +
      '.kb-hist td.num{text-align:right;white-space:nowrap}' +
      '.kb-hist-caixa{max-height:320px;overflow:auto;border:1px solid #e5e5e5;border-radius:6px}';
    document.head.appendChild(s);
  },

  fecharDetalhe() {
    const f = document.getElementById('kb-modal-fundo');
    if (f) f.remove();
    if (this._esc) { document.removeEventListener('keydown', this._esc); this._esc = null; }
  },

  abrirDetalhe(c) {
    this.fecharDetalhe();
    this.estiloModal();

    const fundo = this.el('div', 'kb-modal-fundo');
    fundo.id = 'kb-modal-fundo';
    fundo.addEventListener('click', (e) => { if (e.target === fundo) this.fecharDetalhe(); });
    this._esc = (e) => { if (e.key === 'Escape') this.fecharDetalhe(); };
    document.addEventListener('keydown', this._esc);

    const caixa = this.el('div', 'kb-modal');
    const x = this.el('button', 'kb-modal-fechar', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Fechar');
    x.addEventListener('click', () => this.fecharDetalhe());
    caixa.appendChild(x);

    caixa.appendChild(this.el('h3', '', c.razao));
    if (c.fantasia) caixa.appendChild(this.el('p', 'kb-modal-sub', c.fantasia));

    const dados = this.el('div', 'kb-modal-dados');
    const campo = (rotulo, valor) => {
      const d = this.el('div');
      d.appendChild(this.el('small', '', rotulo));
      d.appendChild(this.el('span', '', valor || '—'));
      dados.appendChild(d);
    };
    campo('CNPJ / CPF', this.cnpjBr(c.cnpj));
    campo('Cidade', (c.municipio || '') + (c.uf ? ' - ' + c.uf : ''));
    campo('Telefone', c.telefone);
    campo('Última entrega', c.ultimaData ? this.dataBr(c.ultimaData) + ' (' + c.dias + ' dias)' : 'Sem pedido registrado');
    campo('Situação no kanban', this.ROTULOS[c.status] || c.status);
    if (c.usuario) campo('Atendido por', c.usuario);
    caixa.appendChild(dados);
    if (c.obs) {
      caixa.appendChild(this.el('h4', '', 'Observação'));
      caixa.appendChild(this.el('p', '', c.obs));
    }

    const titulo = this.el('h4', '', 'Histórico de pedidos');
    const area = this.el('div', '', 'Carregando pedidos...');
    caixa.append(titulo, area);

    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    this.carregarHistorico(c, titulo, area, fundo);
  },

  async carregarHistorico(c, titulo, area, fundo) {
    let r;
    try {
      r = await Api.chamar('historico', { cnpj: c.cnpj });
    } catch (e) {
      r = { ok: false, erro: 'Falha ao buscar os pedidos.' };
    }
    if (!fundo.isConnected) return; // popup já foi fechado
    area.replaceChildren();
    if (!r || !r.ok) {
      area.textContent = (r && r.erro) || 'Não foi possível carregar o histórico.';
      return;
    }
    titulo.textContent = 'Histórico de pedidos (' + r.total + ' · ' + this.moeda(r.somaValor) + ')';
    if (!r.total) {
      area.textContent = 'Nenhum pedido encontrado para este cliente.';
      return;
    }
    const caixa = this.el('div', 'kb-hist-caixa');
    const tab = this.el('table', 'kb-hist');
    const cab = this.el('tr');
    ['Pedido', 'Data', 'Valor', 'Entrega', 'Situação', 'Repre'].forEach((t) => cab.appendChild(this.el('th', '', t)));
    const thead = this.el('thead');
    thead.appendChild(cab);
    tab.appendChild(thead);
    const corpo = this.el('tbody');
    r.pedidos.forEach((p) => {
      const tr = this.el('tr');
      tr.appendChild(this.el('td', '', p.pedido));
      tr.appendChild(this.el('td', '', this.dataBr(p.data)));
      tr.appendChild(this.el('td', 'num', p.valor));
      tr.appendChild(this.el('td', '', /^\d{4}-\d{2}-\d{2}$/.test(p.entregaTxt) ? this.dataBr(p.entregaTxt) : p.entregaTxt));
      tr.appendChild(this.el('td', '', p.situacao));
      tr.appendChild(this.el('td', '', p.repre));
      corpo.appendChild(tr);
    });
    tab.appendChild(corpo);
    caixa.appendChild(tab);
    area.appendChild(caixa);
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
    // mesma ordem da lista original: menos dias primeiro; sem pedido por último
    this.dados.colunas[novo].sort(this.porDias);
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
