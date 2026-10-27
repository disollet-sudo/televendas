// Painel de gestão (gerente/admin): usuários, estados e cobertura.
// Usa as ações: usuarios, salvarEstados, salvarUsuario, ativarUsuario, resetSenha, cobertura.
const Painel = {
  UFS: ['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to'],
  usuarios: [],
  semDona: [],

  el(tag, classe, texto) { return Kanban.el(tag, classe, texto); },

  lista(v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
    return String(v || '').split(/[,;\s]+/).map(function (x) { return x.toLowerCase(); }).filter(Boolean);
  },

  async iniciar() {
    const area = document.getElementById('conteudo');
    area.textContent = 'Carregando...';
    const r = await Api.chamar('usuarios');
    if (!r.ok) { area.textContent = r.erro || 'Não foi possível carregar os usuários.'; return; }
    this.usuarios = r.usuarios;
    const c = await Api.chamar('cobertura');
    this.semDona = c.ok ? (c.semDona || []) : [];
    this.desenhar();
  },

  desenhar() {
    const area = document.getElementById('conteudo');
    area.replaceChildren();

    const cob = this.el('p', 'pn-cobertura');
    cob.textContent = this.semDona.length
      ? 'Estados sem usuária: ' + this.semDona.join(', ').toUpperCase()
      : 'Todos os estados têm pelo menos uma usuária.';
    area.appendChild(cob);

    const tabela = this.el('table', 'pn-tabela');
    const cab = this.el('tr');
    ['Usuário', 'Perfil', 'Repre', 'Estados (ex.: sp,mg)', 'Ativo', ''].forEach((t) => cab.appendChild(this.el('th', '', t)));
    const thead = this.el('thead'); thead.appendChild(cab); tabela.appendChild(thead);
    const corpo = this.el('tbody');
    this.usuarios.forEach((u) => corpo.appendChild(this.linha(u)));
    tabela.appendChild(corpo);
    const rolagem = this.el('div', 'pn-rolagem'); rolagem.appendChild(tabela);
    area.appendChild(rolagem);

    area.appendChild(this.formNovo());
  },

  linha(u) {
    const tr = this.el('tr');
    tr.appendChild(this.el('td', '', u.login));
    tr.appendChild(this.el('td', '', u.perfil));
    tr.appendChild(this.el('td', '', String(u.repre || u.codRepre || u.cod_repre || '')));

    const tdE = this.el('td');
    const inp = this.el('input', 'pn-estados');
    inp.value = this.lista(u.estados).join(',');
    const salvar = this.el('button', 'pn-btn', 'Salvar');
    salvar.type = 'button';
    salvar.addEventListener('click', async () => {
      const ufs = this.lista(inp.value);
      const ruim = ufs.filter((x) => this.UFS.indexOf(x) < 0);
      if (ruim.length) { Kanban.aviso('UF inválida: ' + ruim.join(', ')); return; }
      salvar.disabled = true;
      const r = await Api.chamar('salvarEstados', { login: u.login, estados: ufs.join(',') });
      salvar.disabled = false;
      if (!r.ok) { Kanban.aviso(r.erro || 'Não foi possível salvar.'); return; }
      Kanban.aviso('Estados de ' + u.login + ' salvos.');
      this.iniciar();
    });
    tdE.append(inp, salvar);
    tr.appendChild(tdE);

    const tdA = this.el('td');
    const chk = this.el('input'); chk.type = 'checkbox'; chk.checked = !!u.ativo;
    chk.addEventListener('change', async () => {
      const r = await Api.chamar('ativarUsuario', { login: u.login, ativo: chk.checked });
      if (!r.ok) { chk.checked = !chk.checked; Kanban.aviso(r.erro || 'Não foi possível alterar.'); return; }
      u.ativo = chk.checked;
    });
    tdA.appendChild(chk);
    tr.appendChild(tdA);

    const tdR = this.el('td');
    const reset = this.el('button', 'pn-btn pn-sec', 'Resetar senha');
    reset.type = 'button';
    reset.addEventListener('click', async () => {
      const nova = prompt('Nova senha provisória para ' + u.login + ' (mín. 6 caracteres):');
      if (!nova) return;
      const r = await Api.chamar('resetSenha', { login: u.login, novaSenha: nova });
      Kanban.aviso(r.ok ? 'Senha de ' + u.login + ' redefinida. Ela troca no próximo acesso.' : (r.erro || 'Falha ao redefinir.'));
    });
    tdR.appendChild(reset);
    tr.appendChild(tdR);
    return tr;
  },

  formNovo() {
    const f = this.el('form', 'pn-novo');
    f.appendChild(this.el('h3', '', 'Novo usuário'));
    const campos = {};
    [['login', 'Login'], ['repre', 'Código de repre'], ['estados', 'Estados (sp,mg)'], ['senha', 'Senha provisória']].forEach((p) => {
      const l = this.el('label', '', p[1]);
      const i = this.el('input'); if (p[0] === 'senha') i.type = 'password';
      l.appendChild(i); f.appendChild(l); campos[p[0]] = i;
    });
    const lp = this.el('label', '', 'Perfil');
    const sel = this.el('select');
    ['usuario', 'gerente', 'admin'].forEach((v) => { const o = this.el('option', '', v); o.value = v; sel.appendChild(o); });
    lp.appendChild(sel); f.appendChild(lp);
    const b = this.el('button', 'pn-btn', 'Criar usuário'); b.type = 'submit';
    f.appendChild(b);
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const dados = {
        login: campos.login.value.trim().toUpperCase(),
        perfil: sel.value,
        repre: campos.repre.value.trim(),
        estados: this.lista(campos.estados.value).join(','),
        senha: campos.senha.value
      };
      if (!dados.login || !dados.senha) { Kanban.aviso('Informe login e senha provisória.'); return; }
      b.disabled = true;
      const r = await Api.chamar('salvarUsuario', { dadosUsuario: dados });
      b.disabled = false;
      if (!r.ok) { Kanban.aviso(r.erro || 'Não foi possível criar.'); return; }
      Kanban.aviso('Usuário ' + dados.login + ' criado.');
      this.iniciar();
    });
    return f;
  }
};
