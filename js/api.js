/**
 * Api.gs - ponto de entrada do Web App.
 * O front (GitHub Pages) chama via POST com corpo JSON.
 * Use o header 'Content-Type': 'text/plain;charset=utf-8' no fetch
 * para evitar o pré-voo de CORS do navegador.
 *
 * Ações: login, logout, me, trocarSenha, kanban, atualizarCard, janelas,
 * salvarJanela, clientes, atualizarBase, diagnosticoBase
 * + gestão (Etapa 6): usuarios, salvarEstados, salvarUsuario,
 *   ativarUsuario, resetSenha, cobertura
 * + presença e visão geral (Etapa 7): heartbeat, presenca, atividadeUsuario,
 *   visaoResumo, visaoClientes
 */

function doGet() {
  return saida_({ ok: true, msg: 'API TELEVENDAS no ar' });
}

function doPost(e) {
  var resp;
  try {
    var req = JSON.parse(e.postData.contents);
    resp = rotear_(req);
  } catch (err) {
    console.error(err);
    resp = { ok: false, erro: 'Erro interno.' };
  }
  return saida_(resp);
}

function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rotear_(req) {
  switch (req.acao) {
    case 'login':
      return login_(req.usuario, req.senha);
    case 'logout':
      return logout_(req.token);
    case 'me':
      var p = validarSessao_(req.token);
      return p ? { ok: true, perfil: p }
               : { ok: false, erro: 'Sessão expirada.', sessaoExpirada: true };
    case 'trocarSenha':
      return trocarSenha_(req.token, req.senhaAtual, req.senhaNova);
    case 'kanban':
      var pk = validarSessao_(req.token);
      if (!pk) return { ok: false, erro: 'Sessão expirada.', sessaoExpirada: true };
      var alvo = alvoKanban_(pk, req); // gerente/admin podem ver o quadro de uma usuária
      if (!alvo) return { ok: false, erro: 'Usuária não encontrada.' };
      return montarKanban_(alvo, req);
    case 'atualizarCard':
      return atualizarCard_(validarSessao_(req.token), req);
    case 'janelas':
      return resumoJanelas_(validarSessao_(req.token), req);
    case 'salvarJanela':
      return salvarJanela_(validarSessao_(req.token), req);
    case 'clientes':
      var pc = validarSessao_(req.token);
      if (!pc) return { ok: false, erro: 'Sessão expirada.', sessaoExpirada: true };
      return listarClientes_(pc, req);
    case 'atualizarBase':
      var pa = validarSessao_(req.token);
      if (!pa || (pa.acesso !== 'ADMIN' && pa.acesso !== 'GERENTE')) {
        return { ok: false, erro: 'Sem permissão.' };
      }
      return atualizarBase();
    case 'diagnosticoBase':
      var pf = validarSessao_(req.token);
      if (!pf || (pf.acesso !== 'ADMIN' && pf.acesso !== 'GERENTE')) {
        return { ok: false, erro: 'Sem permissão.' };
      }
      return { ok: true, diag: montarBase_().diag };

    // ---- Etapa 6: gestão de usuários e estados ----
    case 'usuarios':
    case 'salvarEstados':
    case 'salvarUsuario':
    case 'ativarUsuario':
    case 'resetSenha':
    case 'cobertura':
      return gestao_(req);

    // ---- Etapa 7: presença e visão geral ----
    case 'heartbeat':
      return comSessao_(req, presRegistrar_);
    case 'presenca':
      return comSessao_(req, presResumo_);
    case 'atividadeUsuario':
      return comSessao_(req, presAtividade_);
    case 'visaoResumo':
      return comSessao_(req, visaoResumo_);
    case 'visaoClientes':
      return comSessao_(req, visaoClientes_);

    default:
      return { ok: false, erro: 'Ação desconhecida.' };
  }
}

/**
 * Adapta a sessão do Auth.gs para o formato do Usuarios.gs
 * ({login, perfil}) e devolve erros como texto, sem "Erro interno".
 */
function gestao_(req) {
  var p = validarSessao_(req.token);
  if (!p) return { ok: false, erro: 'Sessão expirada.', sessaoExpirada: true };
  var sessao = { login: p.usuario || p.login, perfil: p.acesso };
  try {
    switch (req.acao) {
      case 'usuarios':       return usrListar(sessao);
      case 'salvarEstados':  return usrSalvarEstados(sessao, req.login, req.estados);
      case 'salvarUsuario':  return usrSalvarUsuario(sessao, req.dadosUsuario);
      case 'ativarUsuario':  return usrAtivar(sessao, req.login, req.ativo);
      case 'resetSenha':     return usrResetSenha(sessao, req.login, req.novaSenha);
      case 'cobertura':      return usrCobertura(sessao);
    }
  } catch (err) {
    return { ok: false, erro: String(err.message || err) };
  }
}

// ---------- Testes manuais no editor ----------
// Troque os valores, rode e veja o resultado em Execuções/Logs.
function testeLogin() {
  var r = login_('USUARIO_AQUI', 'SENHA_AQUI');
  Logger.log(JSON.stringify(r));
}

// Testa a gestão pela própria API, logando como ADMIN ou GERENTE.
function testeApiGestao() {
  var l = login_('USUARIO_ADMIN_AQUI', 'SENHA_AQUI');
  if (!l.ok) { Logger.log('Login falhou: ' + JSON.stringify(l)); return; }
  var r1 = rotear_({ acao: 'usuarios', token: l.token });
  Logger.log('usuarios: ' + (r1.ok ? r1.usuarios.length + ' ok' : JSON.stringify(r1)));
  var r2 = rotear_({ acao: 'cobertura', token: l.token });
  Logger.log('sem dona: ' + (r2.ok ? r2.semDona.join(',') : JSON.stringify(r2)));
  var r3 = rotear_({ acao: 'visaoResumo', token: l.token });
  Logger.log('visão geral: ' + (r3.ok ? JSON.stringify(r3.totais) : JSON.stringify(r3)));
  logout_(l.token);
}
