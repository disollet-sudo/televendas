// Tela do kanban: colunas, cards, popup do cliente, mover entre colunas, observações e agendamento de retorno.
// Usa as ações 'kanban', 'atualizarCard', 'historico', 'notas', 'adicionarNota', 'agendar' e 'concluirAgenda' da API.
const Kanban = {
  ROTULOS: {
    A_CHAMAR: 'A chamar',
    EM_CONTATO: 'Em contato',
    RETORNAR: 'Retornar',
    NEGOCIACAO: 'Negociação',
    AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
    PEDIDO_CREDITO: 'Pedido crédito',
    PEDIDO_FEITO: 'Pedido feito',
    NAO_COMPRA_TELE: 'Não compra com Tele',
    INAPTA: 'Inapta',
    TELEFONE_ERRADO: 'Telefone errado',
    ATRASADOS: 'Atrasados',
    SEM_INTERESSE: 'Sem interesse'
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

  hojeIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
    const box = this.el('div', 'kb-card' + (c.atrasado ? ' kb-atrasado' : ''));
    box.style.cursor = 'pointer';
    box.appendChild(this.el('strong', 'kb-razao', c.razao));
    if (c.fantasia) box.appendChild(this.el('div', 'kb-fantasia', c.fantasia));
    box.appendChild(this.el('div', 'kb-linha', (c.municipio || '') + ' - ' + (c.uf || '')));
    box.appendChild(this.el('div', 'kb-linha', this.textoEntrega(c)));
    if (c.agendaData) {
      box.appendChild(this.el('div', 'kb-linha kb-agenda' + (c.atrasado ? ' kb-atrasado' : ''),
        (c.atrasado ? 'Retorno atrasado: ' : 'Retorno agendado: ') + this.dataBr(c.agendaData) +
        (c.agendaNota ? ' · ' + c.agendaNota : '')));
    }
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
      ligar.addEventListener('click', () => this.chamou(c));
      acoes.appendChild(ligar);
    }
    if (tel.length >= 10) {
      const wa = this.el('a', 'kb-link kb-wa', 'WhatsApp');
      wa.href = 'https://wa.me/' + (tel.indexOf('55') === 0 && tel.length >= 12 ? tel : '55' + tel);
      wa.target = '_blank';
      wa.rel = 'noopener';
      // ao clicar no WhatsApp, quem está em "A chamar" passa para "Em contato";
      // nos demais casos, um retorno vencido é considerado atendido
      wa.addEventListener('click', () => {
        if (c.status === 'A_CHAMAR') this.mover(c, 'EM_CONTATO', sel);
        else this.chamou(c);
      });
      acoes.appendChild(wa);
    }
    if (c.telefone) acoes.appendChild(this.el('span', 'kb-tel', c.telefone));
    box.appendChild(acoes);

    // mover
    box.appendChild(sel);

    // observações (histórico) e agendamento
    const det = this.el('details', 'kb-obs');
    det.appendChild(this.el('summary', '', c.obs ? 'Observação ✎' : 'Observação'));
    if (c.obs) det.appendChild(this.el('div', 'kb-ultima-obs', 'Última: ' + c.obs));
    det.appendChild(this.formNota(c, null));
    box.appendChild(det);

    const ag = this.el('details', 'kb-obs');
    ag.appendChild(this.el('summary', '', 'Agendar retorno'));
    ag.appendChild(this.formAgenda(c));
    box.appendChild(ag);

    // clicar no card abre o popup (menos nos botões, links, seletor, campos e detalhes)
    box.addEventListener('click', (e) => {
      if (e.target.closest('a, button, select, textarea, input, details')) return;
      this.abrirDetalhe(c);
    });
    return box;
  },

  // ---------- observações e agenda ----------

  // observação nova: adiciona ao histórico, nunca sobrescreve
  formNota(c, aoAdicionar) {
    const f = this.el('div', 'kb-form-nota');
    const txt = this.el('textarea', 'kb-texto');
    txt.rows = 3;
    txt.placeholder = 'Nova observação (as anteriores ficam guardadas)';
    const btn = this.el('button', 'kb-salvar', 'Adicionar');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      const texto = txt.value.trim();
      if (!texto) return;
      btn.disabled = true;
      const r = await Api.chamar('adicionarNota', { cnpj: c.cnpj, texto: texto });
      btn.disabled = false;
      if (!r.ok) { this.aviso(r.erro || 'Não foi possível salvar a observação.'); return; }
      c.obs = texto;
      txt.value = '';
      btn.textContent = 'Salvo ✓';
      setTimeout(function () { btn.textContent = 'Adicionar'; }, 1500);
      if (aoAdicionar) aoAdicionar(r.nota);
    });
    f.append(txt, btn);
    return f;
  },

  formAgenda(c) {
    const f = this.el('div', 'kb-form-agenda');
    const data = this.el('input', 'kb-data');
    data.type = 'date';
    data.min = this.hojeIso();
    if (c.agendaData && c.agendaData >= data.min) data.value = c.agendaData;
    const nota = this.el('input', 'kb-nota-agenda');
    nota.placeholder = 'Motivo (opcional)';
    nota.maxLength = 200;
    const btn = this.el('button', 'kb-salvar', 'Agendar');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      if (!data.value) { this.aviso('Escolha a data do retorno.'); return; }
      btn.disabled = true;
      const r = await Api.chamar('agendar', { cnpj: c.cnpj, data: data.value, nota: nota.value });
      btn.disabled = false;
      if (!r.ok) { this.aviso(r.erro || 'Não foi possível agendar.'); return; }
      this.aviso('Retorno agendado para ' + this.dataBr(data.value));
      this.fecharDetalhe();
      this.iniciar(); // o card pode mudar de coluna
    });
    f.append(data, nota, btn);
    return f;
  },

  // clicou em Ligar/WhatsApp: considera o retorno vencido como atendido
  async chamou(c) {
    if (!c.agendaData || c.agendaData > this.hojeIso()) return;
    const r = await Api.chamar('concluirAgenda', { cnpj: c.cnpj });
    if (r.ok) this.iniciar();
  },

  async carregarNotas(c, lista) {
    let r;
    try { r = await Api.chamar('notas', { cnpj: c.cnpj }); } catch (e) { r = { ok: false }; }
    if (!lista.isConnected) return;
    lista.replaceChildren();
    if (!r || !r.ok) { lista.textContent = (r && r.erro) || 'Não foi possível carregar as observações.'; return; }
    if (!r.notas.length) { lista.textContent = 'Nenhuma observação ainda.'; return; }
    r.notas.forEach((n) => this.notaNaLista(lista, n, false));
  },

  notaNaLista(lista, n, topo) {
    if (!lista.querySelector('.kb-nota')) lista.replaceChildren();
    const d = this.el('div', 'kb-nota');
    d.appendChild(this.el('small', '', (n.quando ? n.quando + ' · ' : '') + (n.usuario || '')));
    d.appendChild(this.el('div', '', n.texto));
    if (topo) lista.prepend(d); else lista.appendChild(d);
  },

  // ---------- popup do cliente ----------
  estiloModal() {
    if (document.getElementById('kb-modal-css')) return;
    const s = document.createElement('style');
    s.id = 'kb-modal-css';
    s.textContent =
      '.kb-modal-fundo{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:12px}' +
      '.kb-modal{background:#fff;border-radius:10px;max-width:820px;width:100%;max-height:90vh;overflow:auto;padding:18px 20px;box-shadow:0 10px 30px rgba(0,0,0,.3);position:relative}' +
      '.kb-modal-fechar{position:absolute;top:8px;right:12px;border:0;background:none;font-size:26px;cursor:pointer;line-height:1;color:#1f2937}' +
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
    if (c.agendaData) {
      campo('Retorno', this.dataBr(c.agendaData) + (c.atrasado ? ' (atrasado)' : '') + (c.agendaNota ? ' · ' + c.agendaNota : ''));
    }
    caixa.appendChild(dados);

    caixa.appendChild(this.el('h4', '', 'Agendar retorno'));
    caixa.appendChild(this.formAgenda(c));

    caixa.appendChild(this.el('h4', '', 'Observações'));
    const listaNotas = this.el('div', 'kb-notas', 'Carregando...');
    caixa.appendChild(this.formNota(c, (n) => this.notaNaLista(listaNotas, n, true)));
    caixa.appendChild(listaNotas);
    this.carregarNotas(c, listaNotas);

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
    // recarrega: mover pode encerrar/fechar retornos e mudar a coluna real do card
    this.iniciar();
  }
};
