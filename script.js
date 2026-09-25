const CHAVES = {
  TIMES: 'torneio_times',
  GRUPOS: 'torneio_grupos',
  RODADAS: 'torneio_rodadas',
  MATA_MATA: 'torneio_mata_mata'
};

function carregar(chave, padrao) {
  const dado = localStorage.getItem(chave);
  return dado ? JSON.parse(dado) : padrao;
}

function salvar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

let estado = {
  times: carregar(CHAVES.TIMES, []),
  grupos: carregar(CHAVES.GRUPOS, { A: [], B: [] }),
  rodadas: carregar(CHAVES.RODADAS, { A: [], B: [] }),
  mataMata: carregar(CHAVES.MATA_MATA, null)
};

/* ---------- Navegação entre abas ---------- */
document.querySelectorAll('.aba-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById(btn.dataset.aba).classList.add('ativo');
  });
});

/* ---------- CRUD de Times ---------- */
const inputTime = document.getElementById('input-time');
const listaTimesEl = document.getElementById('lista-times');

function renderTimes() {
  listaTimesEl.innerHTML = '';
  if (estado.times.length === 0) {
    listaTimesEl.innerHTML = '<li class="vazio" style="border:none">Nenhum time cadastrado ainda.</li>';
    return;
  }
  estado.times.forEach((time, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="nome-time" data-idx="${idx}">${time}</span>
      <span>
        <button class="btn-mini editar" data-idx="${idx}">Editar</button>
        <button class="btn-mini excluir" data-idx="${idx}">Excluir</button>
      </span>
    `;
    listaTimesEl.appendChild(li);
  });
}

document.getElementById('btn-add-time').addEventListener('click', () => {
  const nome = inputTime.value.trim();
  if (!nome) return alert('Digite o nome do time.');
  estado.times.push(nome);
  salvar(CHAVES.TIMES, estado.times);
  inputTime.value = '';
  renderTimes();
});

inputTime.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-time').click();
});

listaTimesEl.addEventListener('click', e => {
  const idx = e.target.dataset.idx;
  if (idx === undefined) return;
  if (e.target.classList.contains('excluir')) {
    if (!confirm(`Excluir o time "${estado.times[idx]}"?`)) return;
    estado.times.splice(idx, 1);
    salvar(CHAVES.TIMES, estado.times);
    renderTimes();
  }
  if (e.target.classList.contains('editar')) {
    const novoNome = prompt('Novo nome do time:', estado.times[idx]);
    if (novoNome && novoNome.trim()) {
      estado.times[idx] = novoNome.trim();
      salvar(CHAVES.TIMES, estado.times);
      renderTimes();
    }
  }
});

/* ---------- Sorteio de Grupos ---------- */
function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

document.getElementById('btn-sortear-grupos').addEventListener('click', () => {
  if (estado.times.length < 4) {
    return alert('Cadastre pelo menos 4 times para sortear os grupos.');
  }
  if (estado.times.length % 2 !== 0) {
    return alert('A quantidade de times precisa ser par para dividir igualmente entre os dois grupos.');
  }
  const embaralhados = embaralhar(estado.times);
  const meio = embaralhados.length / 2;
  estado.grupos = {
    A: embaralhados.slice(0, meio),
    B: embaralhados.slice(meio)
  };
  salvar(CHAVES.GRUPOS, estado.grupos);
  // ao re-sortear grupos, zera rodadas e mata-mata antigos
  estado.rodadas = { A: [], B: [] };
  estado.mataMata = null;
  salvar(CHAVES.RODADAS, estado.rodadas);
  salvar(CHAVES.MATA_MATA, estado.mataMata);
  renderGrupos();
  renderRodadas();
  renderClassificacao();
  renderMataMata();
});

document.getElementById('btn-limpar-grupos').addEventListener('click', () => {
  if (!confirm('Limpar o sorteio de grupos? Isso também apaga rodadas e fase final.')) return;
  estado.grupos = { A: [], B: [] };
  estado.rodadas = { A: [], B: [] };
  estado.mataMata = null;
  salvar(CHAVES.GRUPOS, estado.grupos);
  salvar(CHAVES.RODADAS, estado.rodadas);
  salvar(CHAVES.MATA_MATA, estado.mataMata);
  renderGrupos();
  renderRodadas();
  renderClassificacao();
  renderMataMata();
});

function renderGrupos() {
  const listaA = document.getElementById('grupo-a-lista');
  const listaB = document.getElementById('grupo-b-lista');
  listaA.innerHTML = estado.grupos.A.length
    ? estado.grupos.A.map(t => `<li>${t}</li>`).join('')
    : '<li class="vazio" style="border:none">Ainda não sorteado</li>';
  listaB.innerHTML = estado.grupos.B.length
    ? estado.grupos.B.map(t => `<li>${t}</li>`).join('')
    : '<li class="vazio" style="border:none">Ainda não sorteado</li>';
}

/* ---------- Geração de Rodadas (5 times por grupo, round-robin) ---------- */
/* Padrão fixo de confrontos para grupo de 5 times, 5 rodadas, 1 folga por rodada */
const PADRAO_RODADAS_5 = [
  { p1: [0, 1], p2: [2, 3], folga: 4 },
  { p1: [0, 2], p2: [4, 1], folga: 3 },
  { p1: [0, 3], p2: [2, 4], folga: 1 },
  { p1: [0, 4], p2: [1, 3], folga: 2 },
  { p1: [1, 2], p2: [3, 4], folga: 0 }
];

function gerarRodadasGrupo(times) {
  if (times.length !== 5) {
    alert('Este layout de rodadas foi desenhado para grupos de 5 times. Ajuste a quantidade de times para funcionar corretamente.');
  }
  return PADRAO_RODADAS_5.map(r => ({
    partida1: {
      timeA: times[r.p1[0]] ?? null,
      timeB: times[r.p1[1]] ?? null,
      resultado: null
    },
    partida2: {
      timeA: times[r.p2[0]] ?? null,
      timeB: times[r.p2[1]] ?? null,
      resultado: null
    },
    folga: times[r.folga] ?? null
  }));
}

document.getElementById('btn-gerar-combates').addEventListener('click', () => {
  if (estado.grupos.A.length === 0 || estado.grupos.B.length === 0) {
    return alert('Sorteie os grupos primeiro na aba "Sorteio de Grupos".');
  }
  if (!confirm('Gerar novos combates? Isso vai sobrescrever as rodadas atuais.')) return;
  estado.rodadas = {
    A: gerarRodadasGrupo(estado.grupos.A),
    B: gerarRodadasGrupo(estado.grupos.B)
  };
  salvar(CHAVES.RODADAS, estado.rodadas);
  renderRodadas();
  renderClassificacao();
});

document.getElementById('btn-limpar-resultados').addEventListener('click', () => {
  if (!confirm('Apagar todos os resultados lançados nas rodadas?')) return;
  ['A', 'B'].forEach(g => {
    estado.rodadas[g].forEach(r => {
      r.partida1.resultado = null;
      r.partida2.resultado = null;
    });
  });
  salvar(CHAVES.RODADAS, estado.rodadas);
  renderRodadas();
  renderClassificacao();
});

/* ---------- Utilitário: formato de ouro "22.5k" ---------- */
function ouroParaNumero(texto) {
  if (!texto) return 0;
  texto = String(texto).trim().toLowerCase().replace(',', '.');
  if (texto.endsWith('k')) {
    return parseFloat(texto.replace('k', '')) * 1000 || 0;
  }
  return parseFloat(texto) || 0;
}

function numeroParaOuro(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '.0') + 'k';
  }
  return String(num);
}

/* ---------- Render das Rodadas + formulário de resultado ---------- */
function criarBlocoPartida(grupo, rodadaIdx, chavePartida, partida) {
  if (!partida.timeA || !partida.timeB) return '';
  const feito = partida.resultado !== null;
  const res = partida.resultado || { ouroA: '', ouroB: '', killsA: 0, deathsA: 0, assistsA: 0, killsB: 0, deathsB: 0, assistsB: 0, vencedor: null };

  return `
    <div class="partida" data-grupo="${grupo}" data-rodada="${rodadaIdx}" data-partida="${chavePartida}">
      <div class="partida-titulo">
        <span>${partida.timeA}<span class="vs">vs</span>${partida.timeB}</span>
        <span class="status-tag ${feito ? 'feito' : ''}">${feito ? 'Resultado lançado' : 'Pendente'}</span>
      </div>
      <div class="stats-grid">
        <div class="stats-time">
          <strong>${partida.timeA}</strong>
          <label>Ouro (ex: 22.5k)</label>
          <input type="text" class="in-ouroA" value="${res.ouroA ?? ''}" placeholder="22.5k">
          <label>Kills</label>
          <input type="number" class="in-killsA" value="${res.killsA ?? 0}" min="0">
          <label>Mortes</label>
          <input type="number" class="in-deathsA" value="${res.deathsA ?? 0}" min="0">
          <label>Assistências</label>
          <input type="number" class="in-assistsA" value="${res.assistsA ?? 0}" min="0">
        </div>
        <div class="stats-time">
          <strong>${partida.timeB}</strong>
          <label>Ouro (ex: 22.5k)</label>
          <input type="text" class="in-ouroB" value="${res.ouroB ?? ''}" placeholder="22.5k">
          <label>Kills</label>
          <input type="number" class="in-killsB" value="${res.killsB ?? 0}" min="0">
          <label>Mortes</label>
          <input type="number" class="in-deathsB" value="${res.deathsB ?? 0}" min="0">
          <label>Assistências</label>
          <input type="number" class="in-assistsB" value="${res.assistsB ?? 0}" min="0">
        </div>
      </div>
      <div class="partida-acoes">
        <button class="btn-mini salvar-partida">${feito ? 'Atualizar resultado' : 'Salvar resultado'}</button>
        ${feito ? '<button class="btn-mini excluir apagar-partida">Apagar resultado</button>' : ''}
      </div>
    </div>
  `;
}

function renderRodadasGrupo(grupo, containerId) {
  const container = document.getElementById(containerId);
  const rodadas = estado.rodadas[grupo];
  if (!rodadas || rodadas.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhum combate gerado ainda.</p>';
    return;
  }
  container.innerHTML = rodadas.map((r, idx) => `
    <div class="rodada-bloco">
      <h4>${idx + 1}ª Rodada</h4>
      ${criarBlocoPartida(grupo, idx, 'partida1', r.partida1)}
      ${criarBlocoPartida(grupo, idx, 'partida2', r.partida2)}
      ${r.folga ? `<div class="partida folga">Folga: ${r.folga}</div>` : ''}
    </div>
  `).join('');
}

function renderRodadas() {
  renderRodadasGrupo('A', 'tabela-rodadas-a');
  renderRodadasGrupo('B', 'tabela-rodadas-b');
}

/* Delegação de eventos para salvar/apagar resultado de partida */
document.getElementById('grupos').addEventListener('click', e => {
  const bloco = e.target.closest('.partida');
  if (!bloco) return;
  const grupo = bloco.dataset.grupo;
  const rodadaIdx = Number(bloco.dataset.rodada);
  const chavePartida = bloco.dataset.partida;
  const partida = estado.rodadas[grupo][rodadaIdx][chavePartida];

  if (e.target.classList.contains('salvar-partida')) {
    const ouroA = bloco.querySelector('.in-ouroA').value.trim();
    const ouroB = bloco.querySelector('.in-ouroB').value.trim();
    const killsA = Number(bloco.querySelector('.in-killsA').value) || 0;
    const deathsA = Number(bloco.querySelector('.in-deathsA').value) || 0;
    const assistsA = Number(bloco.querySelector('.in-assistsA').value) || 0;
    const killsB = Number(bloco.querySelector('.in-killsB').value) || 0;
    const deathsB = Number(bloco.querySelector('.in-deathsB').value) || 0;
    const assistsB = Number(bloco.querySelector('.in-assistsB').value) || 0;

    if (!ouroA || !ouroB) {
      return alert('Preencha o ouro de ambos os times (ex: 22.5k).');
    }

    const numOuroA = ouroParaNumero(ouroA);
    const numOuroB = ouroParaNumero(ouroB);
    const vencedor = numOuroA === numOuroB ? null : (numOuroA > numOuroB ? partida.timeA : partida.timeB);

    partida.resultado = {
      ouroA, ouroB, killsA, deathsA, assistsA, killsB, deathsB, assistsB, vencedor
    };

    salvar(CHAVES.RODADAS, estado.rodadas);
    renderRodadas();
    renderClassificacao();
  }

  if (e.target.classList.contains('apagar-partida')) {
    if (!confirm('Apagar o resultado desta partida?')) return;
    partida.resultado = null;
    salvar(CHAVES.RODADAS, estado.rodadas);
    renderRodadas();
    renderClassificacao();
  }
});

/* ---------- Classificação (desempate por ouro) ---------- */
function calcularClassificacao(grupo) {
  const nomes = estado.grupos[grupo] || [];
  const tabela = {};
  nomes.forEach(nome => {
    tabela[nome] = { time: nome, vitorias: 0, derrotas: 0, ouro: 0, kills: 0, deaths: 0, assists: 0, jogos: 0 };
  });

  const rodadas = estado.rodadas[grupo] || [];
  rodadas.forEach(r => {
    [r.partida1, r.partida2].forEach(p => {
      if (!p.resultado || !p.timeA || !p.timeB) return;
      const res = p.resultado;
      const tA = tabela[p.timeA];
      const tB = tabela[p.timeB];
      if (!tA || !tB) return;

      tA.jogos++; tB.jogos++;
      tA.ouro += ouroParaNumero(res.ouroA);
      tB.ouro += ouroParaNumero(res.ouroB);
      tA.kills += res.killsA; tA.deaths += res.deathsA; tA.assists += res.assistsA;
      tB.kills += res.killsB; tB.deaths += res.deathsB; tB.assists += res.assistsB;

      if (res.vencedor === p.timeA) { tA.vitorias++; tB.derrotas++; }
      else if (res.vencedor === p.timeB) { tB.vitorias++; tA.derrotas++; }
    });
  });

  return Object.values(tabela).sort((a, b) => {
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    return b.ouro - a.ouro; // desempate por ouro
  });
}

function renderClassificacaoGrupo(grupo, containerId) {
  const container = document.getElementById(containerId);
  const dados = calcularClassificacao(grupo);
  if (dados.length === 0) {
    container.innerHTML = '<p class="vazio">Sem times sorteados neste grupo.</p>';
    return;
  }
  container.innerHTML = `
    <table class="tabela-classificacao">
      <thead>
        <tr>
          <th>#</th><th>Time</th><th>V</th><th>D</th><th>Ouro</th><th>K</th><th>D</th><th>A</th>
        </tr>
      </thead>
      <tbody>
        ${dados.map((t, i) => `
          <tr class="${i < 2 ? 'qualificado' : ''}">
            <td>${i + 1}</td>
            <td>${t.time}</td>
            <td>${t.vitorias}</td>
            <td>${t.derrotas}</td>
            <td>${numeroParaOuro(t.ouro)}</td>
            <td>${t.kills}</td>
            <td>${t.deaths}</td>
            <td>${t.assists}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="dica">Times destacados (top 2) avançam para a semifinal.</p>
  `;
}

function renderClassificacao() {
  renderClassificacaoGrupo('A', 'classificacao-a');
  renderClassificacaoGrupo('B', 'classificacao-b');
}

/* ---------- Fase Final: Semifinais + Final (md3) ---------- */
function criarConfrontoMd3(id) {
  return { id, timeA: null, timeB: null, jogos: [null, null, null], vencedor: null };
}

document.getElementById('btn-gerar-mata-mata').addEventListener('click', () => {
  const classA = calcularClassificacao('A');
  const classB = calcularClassificacao('B');
  if (classA.length < 2 || classB.length < 2) {
    return alert('É necessário ter ao menos 2 times classificados em cada grupo.');
  }
  if (!confirm('Gerar as semifinais com os 2 primeiros de cada grupo? Isso reinicia a fase final.')) return;

  const semi1 = criarConfrontoMd3('semi1');
  semi1.timeA = classA[0].time; // 1º Grupo A
  semi1.timeB = classB[1].time; // 2º Grupo B

  const semi2 = criarConfrontoMd3('semi2');
  semi2.timeA = classB[0].time; // 1º Grupo B
  semi2.timeB = classA[1].time; // 2º Grupo A

  const final = criarConfrontoMd3('final');

  estado.mataMata = { semi1, semi2, final };
  salvar(CHAVES.MATA_MATA, estado.mataMata);
  renderMataMata();
});

document.getElementById('btn-limpar-mata-mata').addEventListener('click', () => {
  if (!confirm('Apagar toda a fase final?')) return;
  estado.mataMata = null;
  salvar(CHAVES.MATA_MATA, estado.mataMata);
  renderMataMata();
});

function calcularVencedorMd3(confronto) {
  let vA = 0, vB = 0;
  confronto.jogos.forEach(j => {
    if (j === 'A') vA++;
    if (j === 'B') vB++;
  });
  if (vA === 2) return confronto.timeA;
  if (vB === 2) return confronto.timeB;
  return null;
}

function renderConfrontoMd3(confronto, containerId) {
  const container = document.getElementById(containerId);
  if (!confronto || !confronto.timeA || !confronto.timeB) {
    container.innerHTML = '<p class="vazio">Aguardando definição dos times.</p>';
    return;
  }
  let vA = confronto.jogos.filter(j => j === 'A').length;
  let vB = confronto.jogos.filter(j => j === 'B').length;

  container.innerHTML = `
    <div class="jogo-md3">
      <div class="placar">
        <span>${confronto.timeA}</span>
        <span class="placar-num">${vA} x ${vB}</span>
        <span>${confronto.timeB}</span>
      </div>
      ${[0, 1, 2].map(i => `
        <div class="game-linha">
          <span>Jogo ${i + 1}</span>
          <select data-jogo="${i}" data-confronto="${confronto.id}">
            <option value="">-- selecione --</option>
            <option value="A" ${confronto.jogos[i] === 'A' ? 'selected' : ''}>${confronto.timeA} venceu</option>
            <option value="B" ${confronto.jogos[i] === 'B' ? 'selected' : ''}>${confronto.timeB} venceu</option>
          </select>
        </div>
      `).join('')}
      ${confronto.vencedor ? `<div class="vencedor-final">🏆 Vencedor: ${confronto.vencedor}</div>` : ''}
    </div>
  `;
}

function renderMataMata() {
  if (!estado.mataMata) {
    document.getElementById('semi1').innerHTML = '<p class="vazio">Gere as semifinais após concluir a fase de grupos.</p>';
    document.getElementById('semi2').innerHTML = '<p class="vazio">Gere as semifinais após concluir a fase de grupos.</p>';
    document.getElementById('final').innerHTML = '<p class="vazio">Aguardando classificados da semifinal.</p>';
    return;
  }
  renderConfrontoMd3(estado.mataMata.semi1, 'semi1');
  renderConfrontoMd3(estado.mataMata.semi2, 'semi2');

  // Atualiza a final automaticamente quando as duas semis tiverem vencedor
  const vencSemi1 = calcularVencedorMd3(estado.mataMata.semi1);
  const vencSemi2 = calcularVencedorMd3(estado.mataMata.semi2);
  estado.mataMata.semi1.vencedor = vencSemi1;
  estado.mataMata.semi2.vencedor = vencSemi2;

  if (vencSemi1 && vencSemi2) {
    estado.mataMata.final.timeA = vencSemi1;
    estado.mataMata.final.timeB = vencSemi2;
  } else {
    estado.mataMata.final.timeA = null;
    estado.mataMata.final.timeB = null;
    estado.mataMata.final.jogos = [null, null, null];
    estado.mataMata.final.vencedor = null;
  }
  estado.mataMata.final.vencedor = calcularVencedorMd3(estado.mataMata.final);

  renderConfrontoMd3(estado.mataMata.final, 'final');
  salvar(CHAVES.MATA_MATA, estado.mataMata);
}

document.getElementById('mata-mata').addEventListener('change', e => {
  if (e.target.tagName !== 'SELECT') return;
  const confrontoId = e.target.dataset.confronto;
  const jogoIdx = Number(e.target.dataset.jogo);
  const valor = e.target.value || null;

  const confronto = confrontoId === 'final' ? estado.mataMata.final : estado.mataMata[confrontoId];
  confronto.jogos[jogoIdx] = valor;
  confronto.vencedor = calcularVencedorMd3(confronto);

  salvar(CHAVES.MATA_MATA, estado.mataMata);
  renderMataMata();
});

/* ---------- Inicialização ---------- */
function iniciar() {
  renderTimes();
  renderGrupos();
  renderRodadas();
  renderClassificacao();
  renderMataMata();
}

iniciar();
