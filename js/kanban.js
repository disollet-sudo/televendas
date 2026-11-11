// Tela do kanban: colunas, cards, popup do cliente, mover entre colunas, observações e agendamento de retorno.
// Usa as ações 'kanban', 'atualizarCard', 'historico', 'notas', 'adicionarNota', 'agendar' e 'concluirAgenda' da API.
// Filtros: botões de estado (UF) e "Minha base" (cards com baseMeninas = true).
// O estilo dos filtros e do pop-up de carregamento fica no css/estilo.css.
// Cliente devedor (aba DEVENDO): o card recebe a etiqueta "Devendo" (c.devendo); o estilo dela está em estiloBase().
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
  ufsSel: [],      // estados ligados no filtro (vazio = todos)
  minhaBase: false, // mostra só clientes da base das meninas
  elTotal: null,
  elFiltros: null,
  _carN: 0,        // quantas ações com pop-up de carregamento estão rodando
  mostrar: {},     // quantos cards já aparecem em cada coluna (carrega aos poucos)
  PAGINA: 40,      // cards por vez em cada coluna
  _tb: null,       // atraso da busca

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

  // número para o botão Ligar: sempre com 00 na frente (sem duplicar)
  telLigar(tel) {
    const d = this.digitos(tel);
    return d.indexOf('00') === 0 ? d : '00' + d;
  },

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
      ? (c.soPedido ? 'Último pedido: ' : 'Última entrega: ') + this.dataBr(c.ultimaData) + ' (' + c.dias + ' dias)'
      : 'Sem pedido registrado';
  },

  // texto da etiqueta de devedor: "Devendo · R$ 1.234,56 · 12 dias de atraso"
  // (valor e dias só aparecem quando a aba DEVENDO tem essas colunas preenchidas)
  textoDevendo(c) {
    let t = 'Devendo';
    if (c.devendoValor > 0) t += ' · ' + this.moeda(c.devendoValor);
    if (c.devendoDias > 0) t += ' · ' + c.devendoDias + (c.devendoDias === 1 ? ' dia' : ' dias') + ' de atraso';
    return t;
  },

  aviso(msg) {
    let a = document.getElementById('kb-aviso');
    if (!a) { a = this.el('div', 'kb-aviso'); a.id = 'kb-aviso'; document.body.appendChild(a); }
    a.textContent = msg;
    a.hidden = false;
    clearTimeout(this._t);
    this._t = setTimeout(function () { a.hidden = true; }, 4000);
  },

  // estilo da etiqueta "Devendo" (colocado uma vez só no <head>)
  estiloBase() {
    if (document.getElementById('kb-base-css')) return;
    const s = document.createElement('style');
    s.id = 'kb-base-css';
    s.textContent =
      '.kb-devendo{display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:700;' +
      'padding:2px 8px;border-radius:999px;margin:4px 0;letter-spacing:.2px}' +
      '.kb-card.kb-card-devendo{box-shadow:inset 4px 0 0 #dc2626}';
    document.head.appendChild(s);
  },

  // ---------- pop-up de carregamento ----------
  mostrarCarregando(msg) {
    this._carN++;
    let f = document.getElementById('kb-carregando');
    if (!f) {
      f = this.el('div', 'car-fundo');
      f.id = 'kb-carregando';
      const caixa = this.el('div', 'car-caixa');
      caixa.appendChild(this.el('div', 'car-roda'));
      const t = this.el('span', '');
      t.id = 'kb-carregando-txt';
      caixa.appendChild(t);
      f.appendChild(caixa);
      document.body.appendChild(f);
    }
    document.getElementById('kb-carregando-txt').textContent = msg || 'Carregando...';
    f.hidden = false;
  },

  esconderCarregando() {
    this._carN = Math.max(0, this._carN - 1);
    if (this._carN === 0) {
      const f = document.getElementById('kb-carregando');
      if (f) f.hidden = true;
    }
  },

  // chama a API mostrando o pop-up enquanto espera
  async chamar(msg, acao, dados) {
    this.mostrarCarregando(msg);
    try {
      return await Api.chamar(acao, dados || {});
    } finally {
      this.esconderCarregando();
    }
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

  resetar() {
    this.fecharDetalhe(); this.dados = null; this.filtro = ''; this.alvo = ''; this.usuarios = null;
    this.ufsSel = []; this.minhaBase = false; this.mostrar = {};
  },

  async iniciar() {
    const area = document.getElementById('conteudo');
    this.mostrarCarregando('Carregando clientes...');
    try {
      if (this.ehGestor() && this.usuarios === null) await this.carregarUsuarios();
      const pedido = {};
      if (this.alvo) pedido.verUsuario = this.alvo;
      if (this.minhaBase) pedido.minhaBase = true;   // o servidor monta a base das meninas
      const r = await Api.chamar('kanban', pedido);
      if (!r.ok) {
        this.alvo = '';
        area.textContent = r.erro || 'Não foi possível carregar o kanban.';
        return;
      }
      this.dados = r;
      this.mostrar = {};
      this.desenhar();
    } finally {
      this.esconderCarregando();
    }
  },

  // ---------- filtros (estado e minha base) ----------
  todosCards() {
    const out = [];
    const cols = (this.dados && this.dados.colunas) || {};
    Object.keys(cols).forEach(function (k) { (cols[k] || []).forEach(function (c) { out.push(c); }); });
    return out;
  },

  // Os estados do filtro são os que aparecem nos cards do quadro (ou seja, os da usuária)
  estadosDoQuadro() {
    const set = {};
    this.todosCards().forEach(function (c) { if (c.uf) set[String(c.uf).toUpperCase()] = true; });
    return Object.keys(set).sort();
  },

  temBaseMeninas() {
    return this.todosCards().some(function (c) { return typeof c.baseMeninas === 'boolean'; });
  },

  desenharFiltros() {
    const box = this.elFiltros;
    box.replaceChildren();
    const ufs = this.estadosDoQuadro();

    if (this.minhaBase || this.temBaseMeninas()) {
      const mb = this.el('button', 'kb-minha' + (this.minhaBase ? ' ativo' : ''), 'Minha base');
      mb.type = 'button';
      mb.setAttribute('aria-pressed', this.minhaBase ? 'true' : 'false');
      mb.addEventListener('click', () => { this.minhaBase = !this.minhaBase; this.iniciar(); });
      box.appendChild(mb);
    }

    if (ufs.length > 1) {
      box.appendChild(this.el('span', 'kb-rotulo', 'Estados:'));
      ufs.forEach((uf) => {
        const ligado = this.ufsSel.indexOf(uf) > -1;
        const b = this.el('button', ligado ? 'ativo' : '', uf);
        b.type = 'button';
        b.setAttribute('aria-pressed', ligado ? 'true' : 'false');
        b.addEventListener('click', () => {
          const i = this.ufsSel.indexOf(uf);
          if (i > -1) this.ufsSel.splice(i, 1); else this.ufsSel.push(uf);
          this.refiltrar();
        });
        box.appendChild(b);
      });
      if (this.ufsSel.length) {
        const limpar = this.el('button', '', 'Todos');
        limpar.type = 'button';
        limpar.addEventListener('click', () => { this.ufsSel = []; this.refiltrar(); });
        box.appendChild(limpar);
      }
    }
    box.hidden = !box.childNodes.length;
  },

  // mudou filtro de estado: volta a mostrar so os primeiros de cada coluna
  refiltrar() {
    this.mostrar = {};
    this.desenharFiltros();
    this.desenharColunas();
  },

  passaFiltros(c) {
    if (this.ufsSel.length && this.ufsSel.indexOf(String(c.uf || '').toUpperCase()) < 0) return false;
    return true;
  },

  // ---------- desenho ----------
  desenhar() {
    this.estiloBase();
    const area = document.getElementById('conteudo');
    area.replaceChildren();

    const barra = this.el('div', 'kb-barra');
    const busca = this.el('input', 'kb-busca');
    busca.placeholder = 'Buscar cliente, CNPJ ou cidade';
    busca.value = this.filtro;
    busca.addEventListener('input', () => {
      this.filtro = busca.value;
      clearTimeout(this._tb);
      this._tb = setTimeout(() => { this.mostrar = {}; this.desenharColunas(); }, 200);
    });
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
    this.elTotal = this.el('span', 'kb-total', 'Total: ' + this.dados.total);
    barra.appendChild(this.elTotal);

    this.elFiltros = this.el('div', 'kb-filtros');
    this.quadro = this.el('div', 'kb-quadro');
    area.appendChild(barra);
    area.appendChild(this.elFiltros);
    if (typeof this.dados.aviso === 'string' && this.dados.aviso) {
      area.appendChild(this.el('p', 'kb-aviso-topo', this.dados.aviso));
    }
    area.appendChild(this.quadro);
    this.desenharFiltros();
    this.desenharColunas();
  },

  // coloca os cards na coluna aos poucos (PAGINA por vez) para o app nao travar com milhares de clientes
  preencherCorpo(corpo, lista, status) {
    let usados = 0;
    let botao = null;
    const mais = () => {
      if (botao) { botao.remove(); botao = null; }
      const limite = Math.min(lista.length, this.mostrar[status] || this.PAGINA);
      for (; usados < limite; usados++) corpo.appendChild(this.card(lista[usados]));
      if (usados < lista.length) {
        botao = this.el('button', 'kb-recarregar', 'Ver mais (' + (lista.length - usados) + ')');
        botao.type = 'button';
        botao.addEventListener('click', () => { this.mostrar[status] = usados + this.PAGINA; mais(); });
        corpo.appendChild(botao);
      }
    };
    mais();
  },

  desenharColunas() {
    const termo = this.filtro.trim().toLowerCase();
    // guarda a rolagem para nao "pular" depois de redesenhar
    const rolagens = {};
    this.quadro.querySelectorAll('.kb-coluna').forEach(function (col) {
      const cp = col.querySelector('.kb-corpo');
      rolagens[col.dataset.status] = cp ? cp.scrollTop : 0;
    });
    const esq = this.quadro.scrollLeft;

    this.quadro.replaceChildren();
    let visiveis = 0;
    this.dados.ordem.forEach((status) => {
      const todos = this.dados.colunas[status] || [];
      const lista = todos.filter((c) => {
        if (!this.passaFiltros(c)) return false;
        if (!termo) return true;
        return [c.razao, c.fantasia, c.cnpj, c.municipio, c.uf].join(' ').toLowerCase().indexOf(termo) >= 0;
      });
      visiveis += lista.length;
      const col = this.el('div', 'kb-coluna kb-' + status);
      col.dataset.status = status;
      col.appendChild(this.el('h2', 'kb-titulo', (this.ROTULOS[status] || status) + ' (' + lista.length + ')'));
      const corpo = this.el('div', 'kb-corpo');
      this.preencherCorpo(corpo, lista, status);
      col.appendChild(corpo);
      this.quadro.appendChild(col);
    });

    this.quadro.scrollLeft = esq;
    this.quadro.querySelectorAll('.kb-coluna').forEach(function (col) {
      const t = rolagens[col.dataset.status];
      if (t) col.querySelector('.kb-corpo').scrollTop = t;
    });

    if (this.elTotal) {
      const filtrando = this.ufsSel.length || termo;
      this.elTotal.textContent = filtrando
        ? 'Mostrando: ' + visiveis + ' de ' + this.dados.total
        : (this.minhaBase ? 'Minha base: ' : 'Total: ') + this.dados.total;
    }
  },

  card(c) {
    const box = this.el('div', 'kb-card' + (c.atrasado ? ' kb-atrasado' : '') + (c.devendo ? ' kb-card-devendo' : ''));
    box.style.cursor = 'pointer';
    box.appendChild(this.el('strong', 'kb-razao', c.razao));
    if (c.devendo) box.appendChild(this.el('div', 'kb-devendo', this.textoDevendo(c)));
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
    const acoes =
