// Controle de telas e eventos. Cada etapa nova adiciona seu próprio módulo.
const App = {
  perfil: null,
  aba: 'kanban',

  mostrar(nome) {
    ['login', 'trocar', 'app'].forEach(function (t) {
      document.getElementById('tela-' + t).hidden = (t !== nome);
    });
  },

  // Abas Kanban | Painel (Painel só para gerente/admin)
  montarAbas() {
    let nav = document.getElementById('abas');
    if (nav) nav.remove();
    if (!Kanban.ehGestor()) return;
    nav = document.createElement('nav');
    nav.id = 'abas';
    nav.className = 'abas';
    [['kanban', 'Kanban'], ['painel', 'Painel']].forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p[1];
      b.dataset.aba = p[0];
      b.className = 'aba' + (p[0] === this.aba ? ' ativa' : '');
      b.addEventListener('click', () => this.trocarAba(p[0]));
      nav.appendChild(b);
    });
    const conteudo = document.getElementById('conteudo');
    conteudo.parentNode.insertBefore(nav, conteudo);
  },

  trocarAba(aba) {
    this.aba = aba;
    document.querySelectorAll('#abas .aba').forEach(function (b) {
      b.classList.toggle('ativa', b.dataset.aba === aba);
    });
    if (aba === 'painel') Painel.iniciar(); else Kanban.iniciar();
  },

  async entrar() {
    this.perfil = await Auth.perfil();
    if (!this.perfil) { this.mostrar('login'); return; }
    const nome = this.perfil.usuario || this.perfil.login || '';
    document.getElementById('topo-usuario').textContent = nome + ' (' + (this.perfil.acesso || '') + ')';
    this.mostrar('app');
    this.aba = 'kanban';
    Kanban.resetar();
    this.montarAbas();
    Kanban.iniciar();
  },

  iniciar() {
    const fLogin = document.getElementById('form-login');
    fLogin.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erro = document.getElementById('login-erro');
      const btn = fLogin.querySelector('button');
      erro.textContent = ''; btn.disabled = true;
      const r = await Auth.login(
        document.getElementById('login-usuario').value.trim(),
        document.getElementById('login-senha').value);
      btn.disabled = false;
      if (!r.ok) { erro.textContent = r.erro || 'Falha no login.'; return; }
      document.getElementById('login-senha').value = '';
      if (r.trocarSenha) { this.mostrar('trocar'); return; }
      this.entrar();
    });

    const fTroca = document.getElementById('form-trocar');
    fTroca.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erro = document.getElementById('trocar-erro');
      const nova = document.getElementById('trocar-nova').value;
      if (nova !== document.getElementById('trocar-repete').value) {
        erro.textContent = 'As senhas novas não conferem.'; return;
      }
      const r = await Auth.trocarSenha(document.getElementById('trocar-atual').value, nova);
      if (!r.ok) { erro.textContent = r.erro || 'Não foi possível trocar.'; return; }
      fTroca.reset(); erro.textContent = '';
      this.entrar();
    });

    document.getElementById('btn-sair').addEventListener('click', async () => {
      await Auth.sair();
      this.mostrar('login');
    });

    this.entrar();
  }
};

document.addEventListener('DOMContentLoaded', function () { App.iniciar(); });
