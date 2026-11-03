// Calendário de retornos agendados.
const Agenda = {
  mes: null, itens: [], dia: null,

  el(tag, classe, texto) { return Kanban.el(tag, classe, texto); },
  area() { return document.getElementById('conteudo'); },

  async iniciar() {
    if (!this.mes) this.mes = Kanban.hojeIso().substring(0, 7);
    this.area().textContent = 'Carregando...';
    const r = await Api.chamar('agenda', { mes: this.mes });
    if (!r.ok) { this.area().textContent = r.erro || 'Não foi possível carregar a agenda.'; return; }
    this.itens = r.itens;
    this.desenhar();
  },

  trocarMes(delta) {
    const p = this.mes.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1 + delta, 1);
    this.mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    this.dia = null;
    this.iniciar();
  },

  desenhar() {
    const area = this.area();
    area.replaceChildren();
    const p = this.mes.split('-').map(Number);
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                   'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    const topo = this.el('div', 'ag-topo');
    const ant = this.el('button', 'ag-nav', '‹'); ant.type = 'button';
    ant.addEventListener('click', () => this.trocarMes(-1));
    const prox = this.el('button', 'ag-nav', '›'); prox.type = 'button';
    prox.addEventListener('click', () => this.trocarMes(1));
    topo.append(ant, this.el('strong', 'ag-titulo', nomes[p[1] - 1] + ' de ' + p[0]), prox);

    const grade = this.el('div', 'ag-grade');
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach((n) => grade.appendChild(this.el('div', 'ag-sem', n)));
    const vazios = new Date(p[0], p[1] - 1, 1).getDay();
    const total = new Date(p[0], p[1], 0).getDate();
    for (let i = 0; i < vazios; i++) grade.appendChild(this.el('div', 'ag-vazio'));

    const hoje = Kanban.hojeIso();
    const porDia = {};
    this.itens.forEach((i) => { (porDia[i.data] = porDia[i.data] || []).push(i); });

    for (let d = 1; d <= total; d++) {
      const iso = this.mes + '-' + String(d).padStart(2, '0');
      const lista = porDia[iso] || [];
      const b = this.el('button', 'ag-dia' + (iso === hoje ? ' ag-hoje' : '') + (iso === this.dia ? ' ag-sel' : ''));
      b.type = 'button';
      b.appendChild(this.el('span', 'ag-n', String(d)));
      if (lista.length) {
        const atras = lista.some((i) => i.atrasado);
        b.appendChild(this.el('span', 'ag-qtd' + (atras ? ' ag-atras' : ''), String(lista.length)));
      }
      b.addEventListener('click', () => { this.dia = iso; this.desenhar(); });
      grade.appendChild(b);
    }
    area.append(topo, grade);
    if (this.dia) this.detalheDia(area, porDia[this.dia] || []);
  },

  detalheDia(area, lista) {
    const box = this.el('div', 'ag-lista');
    box.appendChild(this.el('h3', '', Kanban.dataBr(this.dia) + ' · ' + lista.length + ' retorno(s)'));
    if (!lista.length) box.appendChild(this.el('p', '', 'Nenhum retorno neste dia.'));
    lista.forEach((i) => box.appendChild(this.item(i)));
    area.appendChild(box);
  },

  item(i) {
    const b = this.el('div', 'kb-card' + (i.atrasado ? ' kb-atrasado' : ''));
    b.appendChild(this.el('strong', 'kb-razao', i.cliente));
    if (i.nota) b.appendChild(this.el('div', 'kb-linha', i.nota));
    const sit = i.atrasado ? 'Atrasado' : (i.situacao === 'FEITO' ? 'Feito' : 'Pendente');
    b.appendChild(this.el('div', 'kb-linha', 'Situação: ' + sit + (i.usuario ? ' · ' + i.usuario : '')));

    const tel = Kanban.digitos(i.telefone);
    const acoes = this.el('div', 'kb-acoes');
    if (tel.length >= 8) { const a = this.el('a', 'kb-link', 'Ligar'); a.href = 'tel:' + tel; acoes.appendChild(a); }
    if (tel.length >= 10) {
      const wa = this.el('a', 'kb-link kb-wa', 'WhatsApp');
      wa.href = 'https://wa.me/' + (tel.indexOf('55') === 0 && tel.length >= 12 ? tel : '55' + tel);
      wa.target = '_blank'; wa.rel = 'noopener';
      acoes.appendChild(wa);
    }
    if (i.telefone) acoes.appendChild(this.el('span', 'kb-tel', i.telefone));
    b.appendChild(acoes);

    if (i.situacao === 'PENDENTE') {
      const feito = this.el('button', 'kb-salvar', 'Feito'); feito.type = 'button';
      feito.addEventListener('click', () => this.concluir(i, 'FEITO'));
      const canc = this.el('button', 'kb-recarregar', 'Cancelar'); canc.type = 'button';
      canc.addEventListener('click', () => this.concluir(i, 'CANCELADO'));
      b.append(feito, canc);
    }
    return b;
  },

  async concluir(i, situacao) {
    const r = await Api.chamar('concluirAgenda', { id: i.id, situacao: situacao });
    if (!r.ok) { Kanban.aviso(r.erro || 'Não foi possível atualizar.'); return; }
    this.iniciar();
  }
};
