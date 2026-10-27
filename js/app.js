// Controle de telas e eventos. Cada etapa nova adiciona seu próprio módulo.
const App = {
  perfil: null,

  mostrar(nome) {
    ['login', 'trocar', 'app'].forEach(function (t) {
      document.getElementById('tela-' + t).hidden = (t !== nome);
    });
  },

  async entrar() {
    this.perfil = await Auth.perfil();
    if (!this.perfil) { this.mostrar('login'); return; }
    const nome = this.perfil.usuario || this.perfil.login || '';
    document.getElementById('topo-usuario').textContent = nome + ' (' + (this.perfil.acesso || '') + ')';
    this.mostrar('app');
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
