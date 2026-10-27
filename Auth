// Login, sessão (token) e troca de senha.
// O token fica em sessionStorage: some ao fechar a aba.
const Auth = {
  _chave: 'tv_token',
  token() { return sessionStorage.getItem(this._chave) || ''; },
  limpar() { sessionStorage.removeItem(this._chave); },

  async login(usuario, senha) {
    const r = await Api.chamar('login', { usuario: usuario, senha: senha }, false);
    if (r.ok && r.token) sessionStorage.setItem(this._chave, r.token);
    return r;
  },

  async sair() {
    await Api.chamar('logout');
    this.limpar();
  },

  trocarSenha(atual, nova) {
    return Api.chamar('trocarSenha', { senhaAtual: atual, senhaNova: nova });
  },

  async perfil() {
    if (!this.token()) return null;
    const r = await Api.chamar('me');
    return r.ok ? r.perfil : null;
  }
};
