
// script.js
// Versao inicial: todo o trabalho acontece no navegador.
// A tarefa consiste em levar gerarDesenho para o servidor (Pages Functions)
// e fazer esta pagina apenas enviar o numero e exibir a resposta.


// A funcao gerarDesenho agora esta no servidor, dentro da pasta lib.
// Por isso, removemos a importacao de desenho.js.
// O navegador enviara o numero e o token Google para a API.

// Client ID publico da aplicacao cadastrada no Google Cloud.
const GOOGLE_CLIENT_ID = "162915635529-h5ns758feh90cqtekeb4ed2oh7rb6r4c.apps.googleusercontent.com";

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");

 
// const campoEmail = document.getElementById("email");
// O email sera obtido pelo servidor atraves do token Google.

const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const botaoBaixar = document.getElementById("baixar");

//  identificamos o botao de desenhar para controlar
// quando ele pode ser utilizado.
const botaoDesenhar = formulario.querySelector(
  'button[type="submit"]'
);

let svgAtual = "";

//  armazena temporariamente o token retornado pelo Google.
// Esse token comprova a identidade do usuario perante o servidor.
let idToken = null;




// inicializa o Google Identity Services.
// A biblioteca sera carregada antes de executar esta funcao.
function iniciarGoogle() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,

    // Callback executado quando o usuario conclui o login.
    callback: (resposta) => {

      // Verifica se o Google retornou uma credencial.
      if (!resposta.credential) {
        mensagem.textContent = "Falha no login com Google.";
        return;
      }

      // Armazena o token recebido na memoria do navegador.
      idToken = resposta.credential;

      // Permite desenhar somente depois do login.
      botaoDesenhar.disabled = false;

      mensagem.textContent =
        "Login realizado! Agora voce pode gerar seu desenho.";
    }
  });

  // Renderiza o botao oficial de login do Google.
  google.accounts.id.renderButton(
    document.getElementById("google-login"),
    {
      theme: "outline",
      size: "large",
      text: "signin_with"
    }
  );
}

// NOVO: carrega a biblioteca oficial do Google.
const scriptGoogle = document.createElement("script");

scriptGoogle.src = "https://accounts.google.com/gsi/client";
scriptGoogle.async = true;

// Quando a biblioteca carregar, inicializa a autenticacao.
scriptGoogle.onload = iniciarGoogle;

// Caso o navegador nao consiga carregar a biblioteca.
scriptGoogle.onerror = () => {
  mensagem.textContent =
    "Nao foi possivel carregar o login do Google.";
};

document.head.appendChild(scriptGoogle);




// adicionamos async porque agora precisamos
// aguardar a resposta do servidor.
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagem.textContent = "";

  const numero = Number(campoNumero.value);


  // Validamos o numero diretamente no navegador.
  // O servidor tambem fara essa validacao por seguranca.
  if (!Number.isInteger(numero) || numero < 1 || numero > 100) {
    mensagem.textContent = "Digite um inteiro entre 1 e 100.";
    return;
  }


  // Antes verificavamos se o usuario digitou um email.
  // Agora verificamos se ele realizou o login com Google.
  if (!idToken) {
    mensagem.textContent = "Faca login com Google.";
    return;
  }

  // Limpa o desenho anterior antes de gerar outro.
  area.innerHTML = "";
  svgAtual = "";
  botaoBaixar.hidden = true;

  // Evita varios envios enquanto o servidor responde.
  botaoDesenhar.disabled = true;

  try {

  
    // Envia o numero e o token para a Pages Function.
    // O email nao e enviado pelo formulario.
    const resposta = await fetch("/api/desenho", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },

      body: JSON.stringify({ numero })
    });

    // Recebe o texto retornado pelo servidor.
    // Pode ser o SVG ou uma mensagem de erro.
    const conteudo = await resposta.text();

    // NOVO: tratamento dos erros retornados pela API.
    if (!resposta.ok) {

      if (resposta.status === 400) {
        mensagem.textContent =
          "Numero invalido ou erro nos dados enviados.";
      }

      else if (resposta.status === 401) {
        mensagem.textContent =
          "Login invalido ou expirado. Entre novamente.";

        // Descarta o token que nao foi aceito.
        idToken = null;
      }

      else {
        mensagem.textContent =
          `Erro ${resposta.status}: ${conteudo}`;
      }

      return;
    }

    // ALTERADO:
    // Antes: gerarDesenho(numero, email)
    // Agora: usamos o SVG produzido pelo servidor.
    svgAtual = conteudo;

    area.innerHTML = svgAtual;
    botaoBaixar.hidden = false;

    mensagem.textContent = "Desenho gerado com sucesso!";

  } catch (erro) {

    // Trata falhas de rede ou comunicacao com o servidor.
    mensagem.textContent =
      "Erro de comunicacao com o servidor.";

    console.error(erro);

  } finally {

    // Libera o botao novamente, desde que exista um token.
    botaoDesenhar.disabled = !idToken;
  }
});





// igual a versao original 
// A diferenca e que svgAtual agora vem do servidor.

botaoBaixar.addEventListener("click", () => {
  const arquivo = new Blob([svgAtual], { type: "image/svg+xml" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exemplo.svg";
  link.click();
  URL.revokeObjectURL(url);
});
