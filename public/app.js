const API = "/api/projetos";

const form = document.getElementById("form-projeto");
const listaEl = document.getElementById("lista-projetos");
const vazioEl = document.getElementById("vazio");
const buscaEl = document.getElementById("busca");
const filtroTemaEl = document.getElementById("filtro-tema");
const filtroProgramaEl = document.getElementById("filtro-programa");
const ordenarEl = document.getElementById("ordenar");
const datalistTemas = document.getElementById("temas-existentes");
const datalistProgramas = document.getElementById("programas-existentes");
const formTitulo = document.getElementById("form-titulo");
const btnSalvar = document.getElementById("btn-salvar");
const btnCancelar = document.getElementById("btn-cancelar");
const imagemArquivoEl = document.getElementById("imagem-arquivo");
const imagemPreviaEl = document.getElementById("imagem-previa");
const imagemPreviaImg = document.getElementById("imagem-previa-img");
const btnRemoverImagem = document.getElementById("btn-remover-imagem");

let editandoId = null;
let imagemAtual = ""; // data URL (base64) da imagem selecionada

// ---- Helpers ----
function escapar(txt = "") {
  return String(txt).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Le um arquivo de imagem, redimensiona (max 800px) e devolve um data URL base64
function arquivoParaBase64(arquivo, maxLado = 800) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem invalido."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxLado || height > maxLado) {
          const escala = Math.min(maxLado / width, maxLado / height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        // JPEG com qualidade 0.85 mantem o base64 pequeno
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function mostrarPrevia(dataUrl) {
  imagemAtual = dataUrl || "";
  if (imagemAtual) {
    imagemPreviaImg.src = imagemAtual;
    imagemPreviaEl.hidden = false;
  } else {
    imagemPreviaImg.removeAttribute("src");
    imagemPreviaEl.hidden = true;
  }
}

imagemArquivoEl.addEventListener("change", async () => {
  const arquivo = imagemArquivoEl.files[0];
  if (!arquivo) return;
  try {
    mostrarPrevia(await arquivoParaBase64(arquivo));
  } catch (e) {
    alert(e.message || "Nao foi possivel processar a imagem.");
  }
});

btnRemoverImagem.addEventListener("click", () => {
  imagemArquivoEl.value = "";
  mostrarPrevia("");
});

// ---- Importacao CSV ----
const csvArquivoEl = document.getElementById("csv-arquivo");
const btnBaixarModelo = document.getElementById("baixar-modelo");

// Parser de CSV com suporte a campos entre aspas (que podem conter , e quebras de linha)
function parseCSV(texto) {
  const linhas = [];
  let campo = "";
  let linha = [];
  let dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === ",") {
      linha.push(campo); campo = "";
    } else if (c === "\r") {
      // ignora
    } else if (c === "\n") {
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else {
      campo += c;
    }
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
function semAcento(s) {
  return s.normalize("NFD").replace(DIACRITICOS, "");
}

// Converte as linhas do CSV em objetos de projeto usando o cabecalho
function csvParaProjetos(texto) {
  const linhas = parseCSV(texto).filter((l) => l.some((c) => c.trim() !== ""));
  if (!linhas.length) return [];

  const cabecalho = linhas[0].map((h) => semAcento(h.trim().toLowerCase()));
  // Aceita varios nomes de coluna (ex.: "produto" ou "nome", "link de acesso" ou "url")
  const idx = (...nomes) => {
    for (const n of nomes) {
      const i = cabecalho.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iNome = idx("produto", "nome");
  const iDesc = idx("descricao", "descricao");
  const iTema = idx("tema");
  const iProg = idx("programa");
  const iUrl = idx("link de acesso", "link", "url");
  const iLogin = idx("login", "usuario");
  const iSenha = idx("senha");

  if (iNome === -1) {
    throw new Error('O CSV precisa ter uma coluna "produto" (ou "nome") no cabecalho.');
  }

  const val = (l, i) => (i >= 0 && i < l.length ? l[i].trim() : "");
  return linhas.slice(1).map((l) => ({
    nome: val(l, iNome),
    descricao: val(l, iDesc),
    tema: val(l, iTema),
    programa: val(l, iProg),
    url: val(l, iUrl),
    login: val(l, iLogin),
    senha: val(l, iSenha),
  }));
}

csvArquivoEl.addEventListener("change", async () => {
  const arquivo = csvArquivoEl.files[0];
  if (!arquivo) return;
  try {
    const texto = await arquivo.text();
    const projetos = csvParaProjetos(texto);
    const validos = projetos.filter((p) => p.nome);
    if (!validos.length) {
      alert("Nenhum produto valido encontrado no CSV (verifique a coluna 'produto').");
      return;
    }
    if (!confirm(`Importar ${validos.length} produto(s) do arquivo?`)) return;

    const res = await fetch(`${API}/importar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projetos: validos }),
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(r.erro || "Erro ao importar o CSV.");
      return;
    }
    let msg = `${r.inseridos} produto(s) importado(s).`;
    if (r.ignorados) msg += ` ${r.ignorados} linha(s) ignorada(s) (sem nome).`;
    alert(msg);
    carregar();
  } catch (e) {
    alert(e.message || "Nao foi possivel ler o CSV.");
  } finally {
    csvArquivoEl.value = "";
  }
});

// Gera e baixa um CSV de exemplo
btnBaixarModelo.addEventListener("click", () => {
  const modelo =
    "produto,link de acesso,login,senha\n" +
    "Eleitoral,https://info-bill-pope.shinyapps.io/app-eleitoral/,@pgseplan,seplan123\n" +
    "Entregas no territorio,https://evolution-sistema-entregas.ep9oni.easypanel.host/,visualizador,jc2026\n";
  const blob = new Blob([modelo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modelo-projetos.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- Modal de edicao ----
const modal = document.getElementById("modal-editar");
const formEditar = document.getElementById("form-editar");
const eImagemArquivo = document.getElementById("e-imagem-arquivo");
const eImagemPrevia = document.getElementById("e-imagem-previa");
const eImagemPreviaImg = document.getElementById("e-imagem-previa-img");
const eBtnRemoverImagem = document.getElementById("e-btn-remover-imagem");
let imagemEdicao = ""; // data URL (base64) da imagem no modal

function mostrarPreviaEdicao(dataUrl) {
  imagemEdicao = dataUrl || "";
  if (imagemEdicao) {
    eImagemPreviaImg.src = imagemEdicao;
    eImagemPrevia.hidden = false;
  } else {
    eImagemPreviaImg.removeAttribute("src");
    eImagemPrevia.hidden = true;
  }
}

function abrirModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  formEditar.reset();
  mostrarPreviaEdicao("");
}

// Fechar: botao X, botoes [data-fechar] e tecla Esc
document.getElementById("modal-fechar").addEventListener("click", fecharModal);
modal.querySelectorAll("[data-fechar]").forEach((el) => el.addEventListener("click", fecharModal));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) fecharModal();
});

eImagemArquivo.addEventListener("change", async () => {
  const arquivo = eImagemArquivo.files[0];
  if (!arquivo) return;
  try {
    mostrarPreviaEdicao(await arquivoParaBase64(arquivo));
  } catch (e) {
    alert(e.message || "Nao foi possivel processar a imagem.");
  }
});

eBtnRemoverImagem.addEventListener("click", () => {
  eImagemArquivo.value = "";
  mostrarPreviaEdicao("");
});

// Salvar alteracoes (PUT)
formEditar.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("e-id").value;
  const dados = {
    nome: document.getElementById("e-nome").value,
    descricao: document.getElementById("e-descricao").value,
    tema: document.getElementById("e-tema").value,
    programa: document.getElementById("e-programa").value,
    url: document.getElementById("e-url").value,
    login: document.getElementById("e-login").value,
    senha: document.getElementById("e-senha").value,
    imagem: imagemEdicao,
  };
  if (!dados.nome.trim()) return;

  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.erro || "Erro ao salvar as alteracoes.");
    return;
  }
  fecharModal();
  carregar();
});

// ---- Carregar dados ----
async function carregar() {
  const params = new URLSearchParams();
  if (buscaEl.value.trim()) params.set("busca", buscaEl.value.trim());
  if (filtroTemaEl.value) params.set("tema", filtroTemaEl.value);
  if (filtroProgramaEl.value) params.set("programa", filtroProgramaEl.value);
  if (ordenarEl.value) params.set("ordenar", ordenarEl.value);

  const res = await fetch(`${API}?${params}`);
  const projetos = await res.json();
  render(projetos);
  atualizarStats();
  atualizarOpcoes();
}

// Popula os selects de filtro e datalists com temas/programas cadastrados
async function atualizarOpcoes() {
  const res = await fetch("/api/opcoes");
  const { temas, programas } = await res.json();

  preencherSelect(filtroTemaEl, temas, "Todos os temas");
  preencherSelect(filtroProgramaEl, programas, "Todos os programas");
  preencherDatalist(datalistTemas, temas);
  preencherDatalist(datalistProgramas, programas);
}

function preencherSelect(sel, valores, rotuloVazio) {
  const atual = sel.value;
  sel.innerHTML =
    `<option value="">${rotuloVazio}</option>` +
    valores.map((v) => `<option value="${escapar(v)}">${escapar(v)}</option>`).join("");
  if (valores.includes(atual)) sel.value = atual;
}

function preencherDatalist(dl, valores) {
  dl.innerHTML = valores.map((v) => `<option value="${escapar(v)}"></option>`).join("");
}

async function atualizarStats() {
  const res = await fetch("/api/stats");
  const s = await res.json();
  document.getElementById("stat-total").textContent = s.total;
}

// ---- Render ----
function render(projetos) {
  listaEl.innerHTML = "";
  vazioEl.hidden = projetos.length > 0;

  for (const p of projetos) {
    const card = document.createElement("div");
    card.className = "card";
    const link = p.url
      ? `<a class="card-link" href="${escapar(p.url)}" target="_blank" rel="noopener">🔗 Abrir</a>`
      : "<span></span>";

    const meta = [
      p.tema ? `<span class="meta-item">🎯 ${escapar(p.tema)}</span>` : "",
      p.programa ? `<span class="meta-item">📌 ${escapar(p.programa)}</span>` : "",
    ].join("");

    const imagem = p.imagem
      ? `<img class="card-imagem" src="${escapar(p.imagem)}" alt="Imagem de ${escapar(p.nome)}" loading="lazy" />`
      : "";

    const credenciais = [
      p.login ? `<div class="cred"><span class="cred-rot">👤 Login</span><span class="cred-val">${escapar(p.login)}</span></div>` : "",
      p.senha
        ? `<div class="cred"><span class="cred-rot">🔑 Senha</span><span class="cred-val senha" data-senha="${escapar(p.senha)}">••••••••</span><button type="button" class="ver-senha" title="Mostrar/ocultar">👁️</button></div>`
        : "",
    ].join("");

    card.innerHTML = `
      ${imagem}
      <div class="card-topo">
        <h3 class="card-nome">${escapar(p.nome)}</h3>
      </div>
      ${meta ? `<div class="card-meta">${meta}</div>` : ""}
      ${p.descricao ? `<p class="card-desc">${escapar(p.descricao)}</p>` : ""}
      ${credenciais ? `<div class="card-cred">${credenciais}</div>` : ""}
      <div class="card-rodape">
        ${link}
        <div class="card-acoes">
          <button class="acao editar" data-id="${p.id}">✏️ Editar</button>
          <button class="acao excluir" data-id="${p.id}">🗑️ Excluir</button>
        </div>
      </div>`;

    card.querySelector(".editar").addEventListener("click", () => iniciarEdicao(p));
    card.querySelector(".excluir").addEventListener("click", () => excluir(p.id, p.nome));
    const btnVer = card.querySelector(".ver-senha");
    if (btnVer) {
      btnVer.addEventListener("click", () => {
        const el = card.querySelector(".cred-val.senha");
        const revelada = el.classList.toggle("revelada");
        el.textContent = revelada ? el.dataset.senha : "••••••••";
      });
    }
    listaEl.appendChild(card);
  }
}

// ---- Criar / Atualizar ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    nome: document.getElementById("nome").value,
    descricao: document.getElementById("descricao").value,
    tema: document.getElementById("tema").value,
    programa: document.getElementById("programa").value,
    url: document.getElementById("url").value,
    login: document.getElementById("login").value,
    senha: document.getElementById("senha").value,
    imagem: imagemAtual,
  };
  if (!dados.nome.trim()) {
    alert("Informe o produto.");
    return;
  }
  if (!dados.url.trim()) {
    alert("Informe o link de acesso.");
    return;
  }

  const metodo = editandoId ? "PUT" : "POST";
  const endpoint = editandoId ? `${API}/${editandoId}` : API;

  try {
    const res = await fetch(endpoint, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.erro || `Erro ao salvar (HTTP ${res.status}).`);
      return;
    }
    resetarForm();
    carregar();
  } catch (err) {
    alert("Falha de conexao ao salvar: " + (err.message || err));
  }
});

function iniciarEdicao(p) {
  document.getElementById("e-id").value = p.id;
  document.getElementById("e-nome").value = p.nome;
  document.getElementById("e-descricao").value = p.descricao || "";
  document.getElementById("e-tema").value = p.tema || "";
  document.getElementById("e-programa").value = p.programa || "";
  document.getElementById("e-url").value = p.url || "";
  document.getElementById("e-login").value = p.login || "";
  document.getElementById("e-senha").value = p.senha || "";
  eImagemArquivo.value = "";
  mostrarPreviaEdicao(p.imagem || "");
  abrirModal();
}

function resetarForm() {
  form.reset();
  mostrarPrevia("");
  editandoId = null;
  formTitulo.textContent = "Novo Produto";
  btnSalvar.textContent = "Adicionar";
  btnCancelar.hidden = true;
}

btnCancelar.addEventListener("click", resetarForm);

// ---- Excluir ----
async function excluir(id, nome) {
  if (!confirm(`Excluir o produto "${nome}"?`)) return;
  await fetch(`${API}/${id}`, { method: "DELETE" });
  if (editandoId === id) resetarForm();
  carregar();
}

// ---- Busca / filtro ----
let debounce;
buscaEl.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(carregar, 250);
});
filtroTemaEl.addEventListener("change", carregar);
filtroProgramaEl.addEventListener("change", carregar);
ordenarEl.addEventListener("change", carregar);

// ---- Inicio ----
carregar();
