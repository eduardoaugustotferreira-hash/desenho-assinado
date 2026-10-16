
// Recebe um numero e o token de autenticacao Google.
// Valida as informacoes e gera o desenho no servidor.

// Importa as funcoes originais do professor.
// Esse arquivo esta fora da pasta public.
import { gerarDesenho, numeroValido } from "../../lib/desenho.js";

// Funcao executada quando alguem acessa /api/desenho.
export async function onRequest(context) {

  // request: informacoes enviadas pelo navegador.
  // env: variaveis de ambiente configuradas no Cloudflare.
  const { request, env } = context;

  // ETAPA 1 - VERIFICAR O METODO HTTP
  // A API aceita somente requisicoes POST.
  if (request.method !== "POST") {
    return new Response("Metodo nao permitido.", {
      status: 405
    });
  }

  // O navegador deve enviar um JSON: {"numero": 42}
  let dados;

  try {
    dados = await request.json();
  } catch {
    return new Response("JSON invalido ou ausente.", {
      status: 400
    });
  }

  // Recupera o numero informado.
  const numero = dados?.numero;

  // Usa a funcao de validacao original do professor.
  if (!numeroValido(numero)) {
    return new Response("Numero invalido.", {
      status: 400
    });
  }


  // O token vem no cabecalho Authorization.
  const autorizacao =
    request.headers.get("Authorization") || "";

  // Extrai o token do formato: Bearer <token>
  const resultado = autorizacao.match(/^Bearer\s+(\S+)$/i);

  if (!resultado) {
    return new Response("Token ausente ou invalido.", {
      status: 401
    });
  }

  const token = resultado[1];

  // Verifica se o Client ID foi configurado no Cloudflare.
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response("Configuracao ausente no servidor.", {
      status: 500
    });
  }


  // O servidor consulta o endpoint tokeninfo.
  let respostaGoogle;

  try {
    respostaGoogle = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" +
      encodeURIComponent(token)
    );
  } catch {
    return new Response("Erro na comunicacao com Google.", {
      status: 502
    });
  }

  // O token so sera aceito se o Google retornar HTTP 200.
  if (respostaGoogle.status !== 200) {
    return new Response("Token invalido ou expirado.", {
      status: 401
    });
  }

  let identidade;

  try {
    identidade = await respostaGoogle.json();
  } catch {
    return new Response("Resposta Google invalida.", {
      status: 401
    });
  }


  // aud: identifica para qual aplicativo o token foi emitido.
  // email_verified: indica se o Google verificou o email.
  if (
    identidade.aud !== env.GOOGLE_CLIENT_ID ||
    String(identidade.email_verified) !== "true" ||
    typeof identidade.email !== "string" ||
    !identidade.email.includes("@")
  ) {
    return new Response("Identidade nao autorizada.", {
      status: 401
    });
  }


  // O email vem da resposta validada do Google.
  // O usuario nao pode escolher outro email no formulario.
  const svg = gerarDesenho(numero, identidade.email);

  // Retorna o SVG ao navegador.
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
// TESTE TEMPORARIO: SQL vulneravel para avaliacao da IA.
// Esta funcao nao deve ser utilizada pela aplicacao.
async function testeSqlVulneravel(env, nome) {
  return await env.DB
    .prepare(`SELECT * FROM notas WHERE aluno = '${nome}'`)
    .all();
}