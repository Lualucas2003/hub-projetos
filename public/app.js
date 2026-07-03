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
let anexosCriar = []; // [{ nome, dados(base64) }] no formulario de cadastro
let anexosEditar = []; // idem no modal de edicao

// ---- Anexos PDF (compartilhado entre cadastro e edicao) ----
function lerPdfBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(arquivo);
  });
}

function renderAnexos(lista, container) {
  container.innerHTML = lista
    .map(
      (a, i) =>
        `<div class="anexo-item"><span class="anexo-nome">📄 ${escapar(a.nome)}</span><button type="button" class="anexo-remover" data-i="${i}" title="Remover">✕</button></div>`
    )
    .join("");
  container.querySelectorAll(".anexo-remover").forEach((b) =>
    b.addEventListener("click", () => {
      lista.splice(Number(b.dataset.i), 1);
      renderAnexos(lista, container);
    })
  );
}

async function adicionarPdfs(arquivos, lista, container) {
  for (const f of arquivos) {
    const ehPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) {
      alert(`"${f.name}" nao e um PDF e foi ignorado.`);
      continue;
    }
    try {
      lista.push({ nome: f.name, dados: await lerPdfBase64(f) });
    } catch {
      alert(`Nao foi possivel ler "${f.name}".`);
    }
  }
  renderAnexos(lista, container);
}

const anexoArquivoEl = document.getElementById("anexo-arquivo");
const anexosListaEl = document.getElementById("anexos-lista");
anexoArquivoEl.addEventListener("change", async () => {
  await adicionarPdfs([...anexoArquivoEl.files], anexosCriar, anexosListaEl);
  anexoArquivoEl.value = "";
});

const eAnexoArquivoEl = document.getElementById("e-anexo-arquivo");
const eAnexosListaEl = document.getElementById("e-anexos-lista");
eAnexoArquivoEl.addEventListener("change", async () => {
  await adicionarPdfs([...eAnexoArquivoEl.files], anexosEditar, eAnexosListaEl);
  eAnexoArquivoEl.value = "";
});

// ---- Menu lateral (hamburguer) e navegacao entre telas ----
const btnMenu = document.getElementById("btn-menu");
const menuLateral = document.getElementById("menu-lateral");
const menuOverlay = document.getElementById("menu-overlay");
const menuFechar = document.getElementById("menu-fechar");
const viewInicio = document.getElementById("view-inicio");
const viewCadastro = document.getElementById("view-cadastro");
const viewAcessos = document.getElementById("view-acessos");

function abrirMenu() {
  menuLateral.classList.add("aberto");
  menuOverlay.classList.add("aberto");
}
function fecharMenu() {
  menuLateral.classList.remove("aberto");
  menuOverlay.classList.remove("aberto");
}
btnMenu.addEventListener("click", abrirMenu);
menuFechar.addEventListener("click", fecharMenu);
menuOverlay.addEventListener("click", fecharMenu);

// Alterna entre as telas Inicio / Novo Produto / Acessos
function mostrarView(nome) {
  const views = { inicio: viewInicio, cadastro: viewCadastro, acessos: viewAcessos };
  const alvo = views[nome] ? nome : "inicio";
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== alvo));
  fecharMenu();
  if (alvo === "inicio") carregar();
  if (alvo === "acessos") atualizarAcessos();
}
document.querySelectorAll(".menu-item").forEach((b) =>
  b.addEventListener("click", () => mostrarView(b.dataset.view))
);

// ---- Modo de visualizacao (cards / lista) ----
const verCards = document.getElementById("ver-cards");
const verLista = document.getElementById("ver-lista");

function definirModo(modo) {
  const ehLista = modo === "lista";
  listaEl.classList.toggle("modo-lista", ehLista);
  verLista.classList.toggle("ativo", ehLista);
  verCards.classList.toggle("ativo", !ehLista);
  try {
    localStorage.setItem("modoVisual", modo);
  } catch {}
}
verCards.addEventListener("click", () => definirModo("cards"));
verLista.addEventListener("click", () => definirModo("lista"));
definirModo(localStorage.getItem("modoVisual") || "cards");

// ---- Tema claro / escuro ----
const btnTema = document.getElementById("btn-tema");
function definirTema(tema) {
  const escuro = tema === "escuro";
  document.body.classList.toggle("tema-escuro", escuro);
  btnTema.textContent = escuro ? "☀️" : "🌙";
  try {
    localStorage.setItem("tema", tema);
  } catch {}
}
btnTema.addEventListener("click", () =>
  definirTema(document.body.classList.contains("tema-escuro") ? "claro" : "escuro")
);
definirTema(localStorage.getItem("tema") || "claro");

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
    tipo: document.getElementById("e-tipo").value,
    descricao: document.getElementById("e-descricao").value,
    tema: document.getElementById("e-tema").value,
    programa: document.getElementById("e-programa").value,
    url: document.getElementById("e-url").value,
    login: document.getElementById("e-login").value,
    senha: document.getElementById("e-senha").value,
    imagem: imagemEdicao,
    anexos: anexosEditar,
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
  document.getElementById("stat-paineis").textContent = s.paineis;
  document.getElementById("stat-fichas").textContent = s.fichas;
}

// ---- Render ----
function render(projetos) {
  listaEl.innerHTML = "";
  vazioEl.hidden = projetos.length > 0;

  for (const p of projetos) {
    const card = document.createElement("div");
    const ehFicha = p.tipo === "ficha";
    card.className = `card ${ehFicha ? "ficha" : "painel"}`;

    const temPdf = Array.isArray(p.anexos) && p.anexos.length > 0;
    const botaoAcessar = temPdf
      ? `<button type="button" class="btn-acessar acessar-pdf">ACESSO</button>`
      : p.url
      ? `<a class="btn-acessar" href="${escapar(p.url)}" target="_blank" rel="noopener">ACESSO</a>`
      : `<span class="sem-link">Sem acesso cadastrado</span>`;

    card.innerHTML = `
      <span class="tipo-tag ${ehFicha ? "ficha" : "painel"}">${ehFicha ? "Ficha" : "Painel"}</span>
      <div class="card-acoes">
        <button class="acao editar" data-id="${p.id}" title="Editar">✏️</button>
        <button class="acao excluir" data-id="${p.id}" title="Excluir">🗑️</button>
      </div>
      <h3 class="card-nome">${escapar(p.nome)}</h3>
      ${botaoAcessar}`;

    card.querySelector(".editar").addEventListener("click", () => iniciarEdicao(p));
    card.querySelector(".excluir").addEventListener("click", () => excluir(p.id, p.nome));
    const btnPdf = card.querySelector(".acessar-pdf");
    if (btnPdf) {
      btnPdf.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirPdf(p, 0);
      });
    }
    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-acessar") || e.target.closest(".acao")) return;
      abrirDetalhes(p);
    });
    listaEl.appendChild(card);
  }
}

// ---- Aba Acessos: lista de credenciais ----
const listaAcessosEl = document.getElementById("lista-acessos");
const vazioAcessosEl = document.getElementById("vazio-acessos");
const buscaAcessosEl = document.getElementById("busca-acessos");
let acessosCache = [];

async function atualizarAcessos() {
  const res = await fetch(API);
  acessosCache = await res.json();
  renderAcessos();
}

function renderAcessos() {
  const termo = (buscaAcessosEl.value || "").toLowerCase().trim();
  const itens = acessosCache
    // So produtos que tenham login E senha preenchidos
    .filter((p) => (p.login || "").trim() && (p.senha || "").trim())
    .filter(
      (p) =>
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        (p.login || "").toLowerCase().includes(termo)
    );

  listaAcessosEl.innerHTML = "";
  vazioAcessosEl.hidden = itens.length > 0;

  for (const p of itens) {
    const linha = document.createElement("div");
    linha.className = "acesso-linha";

    const senhaCel = p.senha
      ? `<span class="senha-box"><span class="acesso-val senha" data-senha="${escapar(p.senha)}">••••••••</span><button type="button" class="ver-senha" title="Mostrar/ocultar senha">👁</button></span>`
      : `<span class="acesso-val vazio-cel">—</span>`;

    linha.innerHTML = `
      <div class="acesso-produto">
        <span class="tipo-tag ${p.tipo === "ficha" ? "ficha" : "painel"}">${p.tipo === "ficha" ? "Ficha" : "Painel"}</span>
        <span class="acesso-nome">${escapar(p.nome)}</span>
      </div>
      <div class="acesso-campo"><span class="acesso-rot">Login</span><span class="acesso-val">${p.login ? escapar(p.login) : "—"}</span></div>
      <div class="acesso-campo"><span class="acesso-rot">Senha</span>${senhaCel}</div>`;

    const btnVer = linha.querySelector(".ver-senha");
    if (btnVer) {
      btnVer.addEventListener("click", () => {
        const el = linha.querySelector(".acesso-val.senha");
        const revelada = el.classList.toggle("revelada");
        el.textContent = revelada ? el.dataset.senha : "••••••••";
      });
    }
    linha.style.cursor = "pointer";
    linha.addEventListener("click", (e) => {
      if (e.target.closest(".btn-acessar") || e.target.closest(".ver-senha")) return;
      abrirDetalhes(p);
    });
    listaAcessosEl.appendChild(linha);
  }
}

let debounceAcessos;
buscaAcessosEl.addEventListener("input", () => {
  clearTimeout(debounceAcessos);
  debounceAcessos = setTimeout(renderAcessos, 200);
});

// ---- Modal de detalhes (metadados preenchidos) ----
const modalDetalhes = document.getElementById("modal-detalhes");
const detTitulo = document.getElementById("det-titulo");
const detConteudo = document.getElementById("det-conteudo");

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

function abrirDetalhes(p) {
  detTitulo.textContent = p.nome;
  const linhas = [];
  const add = (rot, val) => {
    if (val) linhas.push(`<div class="det-linha"><span class="det-rot">${rot}</span><span class="det-val">${val}</span></div>`);
  };

  add("Tipo", p.tipo === "ficha" ? "Ficha" : "Painel");
  add("Descricao", p.descricao ? escapar(p.descricao) : "");
  add("Tema", p.tema ? escapar(p.tema) : "");
  add("Programa", p.programa ? escapar(p.programa) : "");
  if (p.url) {
    linhas.push(
      `<div class="det-linha"><span class="det-rot">Link de acesso</span><span class="det-val"><a href="${escapar(p.url)}" target="_blank" rel="noopener">${escapar(p.url)}</a></span></div>`
    );
  }
  add("Login", p.login ? escapar(p.login) : "");
  if (p.senha) {
    linhas.push(
      `<div class="det-linha"><span class="det-rot">Senha</span><span class="det-val det-senha"><span class="senha-txt senha" data-senha="${escapar(p.senha)}">••••••••</span><button type="button" class="ver-senha" title="Mostrar/ocultar">👁️</button></span></div>`
    );
  }
  add("Criado em", formatarData(p.criadoEm));
  add("Atualizado em", formatarData(p.atualizadoEm));

  const img = p.imagem
    ? `<div class="det-linha"><span class="det-rot">Imagem</span><img class="det-img" src="${escapar(p.imagem)}" alt="Imagem de ${escapar(p.nome)}" /></div>`
    : "";

  const anexos = Array.isArray(p.anexos) && p.anexos.length
    ? `<div class="det-linha"><span class="det-rot">Documentos (PDF)</span><div class="det-anexos">${p.anexos
        .map(
          (a, i) =>
            `<button type="button" class="det-anexo" data-i="${i}">📄 ${escapar(a.nome)}</button>`
        )
        .join("")}</div></div>`
    : "";

  detConteudo.innerHTML = linhas.join("") + img + anexos;

  const btnVer = detConteudo.querySelector(".ver-senha");
  if (btnVer) {
    btnVer.addEventListener("click", () => {
      const el = detConteudo.querySelector(".senha-txt");
      const revelada = el.classList.toggle("revelada");
      el.textContent = revelada ? el.dataset.senha : "••••••••";
    });
  }
  detConteudo.querySelectorAll(".det-anexo").forEach((b) =>
    b.addEventListener("click", () => abrirPdf(p, Number(b.dataset.i)))
  );

  modalDetalhes.hidden = false;
  document.body.style.overflow = "hidden";
}

function fecharDetalhes() {
  modalDetalhes.hidden = true;
  document.body.style.overflow = "";
}
document.getElementById("det-fechar").addEventListener("click", fecharDetalhes);
modalDetalhes.querySelectorAll("[data-fechar-det]").forEach((el) => el.addEventListener("click", fecharDetalhes));

// ---- Visualizador de PDF (abre no sistema, sem baixar) ----
const modalPdf = document.getElementById("modal-pdf");
const pdfContainer = document.getElementById("pdf-container");
const pdfTitulo = document.getElementById("pdf-titulo");
const pdfBaixar = document.getElementById("pdf-baixar");
let pdfRenderToken = 0; // cancela renderizacoes antigas

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}

// Abre o PDF renderizando com PDF.js (canvas) - nao depende do visualizador do navegador,
// entao nunca baixa; o usuario final ve o documento na tela.
async function abrirPdf(produto, indice = 0) {
  const anexo = produto && Array.isArray(produto.anexos) ? produto.anexos[indice] : null;
  if (!anexo) return;
  const url = `/api/projetos/${produto.id}/anexos/${indice}`;

  pdfTitulo.textContent = anexo.nome || "Documento";
  pdfBaixar.href = url;
  pdfBaixar.download = anexo.nome || "documento.pdf";
  modalPdf.hidden = false;
  document.body.style.overflow = "hidden";
  pdfContainer.innerHTML = '<p class="pdf-status">Carregando documento...</p>';

  const token = ++pdfRenderToken;
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    if (token !== pdfRenderToken) return; // outro PDF foi aberto
    pdfContainer.innerHTML = "";
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      if (token !== pdfRenderToken) return;
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-pagina";
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pdfContainer.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    }
  } catch (e) {
    if (token === pdfRenderToken) {
      pdfContainer.innerHTML = '<p class="pdf-status">Nao foi possivel exibir o PDF. Use "Baixar".</p>';
    }
  }
}

function fecharPdf() {
  pdfRenderToken++; // cancela render em andamento
  modalPdf.hidden = true;
  pdfContainer.innerHTML = "";
  if (modalDetalhes.hidden) document.body.style.overflow = "";
}
document.getElementById("pdf-fechar").addEventListener("click", fecharPdf);
modalPdf.querySelectorAll("[data-fechar-pdf]").forEach((el) => el.addEventListener("click", fecharPdf));

// Esc fecha o topo primeiro (PDF), senao os detalhes
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalPdf.hidden) fecharPdf();
  else if (!modalDetalhes.hidden) fecharDetalhes();
});

// ---- Criar / Atualizar ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    nome: document.getElementById("nome").value,
    tipo: document.getElementById("tipo").value,
    descricao: document.getElementById("descricao").value,
    tema: document.getElementById("tema").value,
    programa: document.getElementById("programa").value,
    url: document.getElementById("url").value,
    login: document.getElementById("login").value,
    senha: document.getElementById("senha").value,
    imagem: imagemAtual,
    anexos: anexosCriar,
  };
  if (!dados.nome.trim()) {
    alert("Informe o produto.");
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
    mostrarView("acessos");
  } catch (err) {
    alert("Falha de conexao ao salvar: " + (err.message || err));
  }
});

function iniciarEdicao(p) {
  document.getElementById("e-id").value = p.id;
  document.getElementById("e-nome").value = p.nome;
  document.getElementById("e-tipo").value = p.tipo || "painel";
  document.getElementById("e-descricao").value = p.descricao || "";
  document.getElementById("e-tema").value = p.tema || "";
  document.getElementById("e-programa").value = p.programa || "";
  document.getElementById("e-url").value = p.url || "";
  document.getElementById("e-login").value = p.login || "";
  document.getElementById("e-senha").value = p.senha || "";
  eImagemArquivo.value = "";
  mostrarPreviaEdicao(p.imagem || "");
  anexosEditar = Array.isArray(p.anexos) ? p.anexos.map((a) => ({ ...a })) : [];
  renderAnexos(anexosEditar, eAnexosListaEl);
  abrirModal();
}

function resetarForm() {
  form.reset();
  mostrarPrevia("");
  anexosCriar = [];
  renderAnexos(anexosCriar, anexosListaEl);
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
