document.addEventListener('DOMContentLoaded', async () => {
  const config = JSON.parse(sessionStorage.getItem('recitativos_config'));
  if (!config) {
    window.location.href = '/';
    return;
  }

  const irmasContainer = document.getElementById('irmasCards');
  const irmaosContainer = document.getElementById('irmaosCards');
  const summary = document.getElementById('selectionSummary');
  const selectedDateInput = document.getElementById('selectedDate');
  const btnAddIrmas = document.getElementById('btnAddIrmas');
  const btnAddIrmaos = document.getElementById('btnAddIrmaos');
  const btnPreviewReport = document.getElementById('btnPreviewReport');
  const form = document.getElementById('santaCeiaForm');

  let irmasRoundCount = 0;
  let irmaosRoundCount = 0;

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  selectedDateInput.value = today;

  // --- TABS LOGIC ---
  const tabs = document.querySelectorAll('.sac-tab');
  const contents = document.querySelectorAll('.sac-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contents.forEach(c => {
        c.classList.remove('active');
        if (c.id === target) c.classList.add('active');
      });

      // Se clicou na aba de RE SUMO, buscar dados reais
      if (target === 'tabResumo') {
        fetchSummaryData();
      }
    });
  });

  // --- METADATA SYNC ---
  async function fetchEventMetadata() {
    const date = selectedDateInput.value;
    if (!date) return;
    
    try {
      const res = await fetch(`/api/santa-ceia-evento?date=${date}&municipio=${encodeURIComponent(config.municipio)}&comum=${encodeURIComponent(config.comum)}`);
      const data = await res.json();
      
      // SÓ atualiza se o registro realmente existir no banco
      if (data && data.id) {
        document.getElementById('inputAtendimento').value = data.atendimento || '';
        document.getElementById('inputHora').value = data.hora || '';
        document.getElementById('inputPalavra').value = data.palavra || '';
        document.getElementById('inputOracaoPao').value = data.oracao_pao || '';
        document.getElementById('inputOracaoCalice').value = data.oracao_calice || '';
        document.getElementById('inputDiaconos').value = data.diaconos || '';
        const inputAnoAnterior = document.getElementById('inputAnoAnterior');
        if (inputAnoAnterior) inputAnoAnterior.value = data.ano_anterior || 0;
      }
    } catch (err) {
      console.error('Erro ao buscar metadados:', err);
    }
  }

  const inputAnoAnterior = document.getElementById('inputAnoAnterior');
  if (inputAnoAnterior) {
    inputAnoAnterior.addEventListener('focus', () => {
      if (inputAnoAnterior.value === '0') inputAnoAnterior.value = '';
      else inputAnoAnterior.select();
    });
    inputAnoAnterior.addEventListener('blur', () => {
      if (inputAnoAnterior.value === '') inputAnoAnterior.value = '0';
    });
  }

  selectedDateInput.addEventListener('change', () => {
    fetchEventMetadata();
    // Se estiver na aba resumo, atualizar também
    const activeTab = document.querySelector('.sac-tab.active');
    if (activeTab && activeTab.dataset.tab === 'tabResumo') {
      fetchSummaryData();
    }
  });
  fetchEventMetadata(); // Initial fetch

  window.updateSummaryWithName = async (user) => {
    let name = user.user_metadata?.full_name;
    if (!name) {
      try {
        const res = await fetch(`/api/profile?id=${user.id}`);
        const profile = await res.json();
        if (profile.full_name) {
          name = profile.full_name;
        }
      } catch (err) {
        console.error('Erro ao buscar nome completo:', err);
      }
    }

    if (!name) name = user.email?.split('@')[0] || '...';
    if (name.toLowerCase() === 'ricardograngeiro') name = 'Ricardo Grangeiro';
    else if (name.includes('.')) name = name.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    else if (!user.user_metadata?.full_name) name = name.charAt(0).toUpperCase() + name.slice(1);

    window.auxiliarFullName = name;

    summary.innerHTML = `
      <strong>Município:</strong> ${config.municipio} | 
      <strong>Comum:</strong> ${config.comum} <br>
      <span style="color: var(--brand); font-weight: 700;">Responsável: ${name}</span>
    `;
  };

  if (window.currentUser) {
    await window.updateSummaryWithName(window.currentUser);
  }

  function createRoundCard(index, type) {
    const card = document.createElement('div');
    card.className = 'sunday-card';
    card.dataset.index = index;
    card.dataset.type = type;
    
    const label = type === 'irmas' ? 'Irmãs' : 'Irmãos';
    const fieldName = `${type}_${index}`;
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="color: var(--brand); font-weight: 700; font-size: 1rem;">Rodada ${index} (${label})</div>
        ${index > 0 ? `<button type="button" class="btn-remove-round" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">remover</button>` : ''}
      </div>
      <div class="grid-counts" style="grid-template-columns: 1fr 1fr; gap: 15px;">
        <div class="form-group">
          <label>${label}</label>
          <input type="number" name="${fieldName}" min="0" value="0" required class="count-input">
        </div>
        <div class="form-group">
          <label>Total</label>
          <input type="number" name="total_${type}_${index}" value="0" readonly class="count-input total-field">
        </div>
      </div>
    `;

    const input = card.querySelector('.count-input:not(.total-field)');
    const totalField = card.querySelector(`input[name="total_${type}_${index}"]`);
    
    input.addEventListener('focus', () => {
      if (input.value === '0') input.value = '';
      else input.select(); // Selecionar o texto se já houver algo para facilitar a troca
    });

    input.addEventListener('blur', () => {
      if (input.value === '') {
        input.value = '0';
        input.dispatchEvent(new Event('input'));
      }
    });

    input.addEventListener('input', () => {
      totalField.value = input.value || 0;
    });

    const btnRemove = card.querySelector('.btn-remove-round');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        card.remove();
        reorderRounds(type);
      });
    }

    return card;
  }

  function reorderRounds(type) {
    const container = type === 'irmas' ? irmasContainer : irmaosContainer;
    const cards = container.querySelectorAll('.sunday-card');
    const label = type === 'irmas' ? 'Irmãs' : 'Irmãos';
    
    if (type === 'irmas') irmasRoundCount = cards.length;
    else irmaosRoundCount = cards.length;

    cards.forEach((card, i) => {
      const newIndex = i + 1;
      card.dataset.index = newIndex;
      card.querySelector('div > div').textContent = `Rodada ${newIndex} (${label})`;
      
      const countInput = card.querySelector(`input[name^="${type}_"]`);
      const totalInput = card.querySelector(`input[name^="total_${type}_"]`);
      
      countInput.name = `${type}_${newIndex}`;
      totalInput.name = `total_${type}_${newIndex}`;
    });
  }

  function addRound(type) {
    const container = type === 'irmas' ? irmasContainer : irmaosContainer;
    if (type === 'irmas') {
      irmasRoundCount++;
      container.appendChild(createRoundCard(irmasRoundCount, 'irmas'));
    } else {
      irmaosRoundCount++;
      container.appendChild(createRoundCard(irmaosRoundCount, 'irmaos'));
    }
  }

  // --- PERSISTÊNCIA DE RASCUNHO ---
  function saveDraft() {
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());
    
    // Capturar estrutura de rodadas
    const roundsIrmas = [];
    irmasContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      roundsIrmas.push({ rodada: parseInt(idx), val: rawData[`irmas_${idx}`] || '0' });
    });

    const roundsIrmaos = [];
    irmaosContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      roundsIrmaos.push({ rodada: parseInt(idx), val: rawData[`irmaos_${idx}`] || '0' });
    });

    const draft = {
      date: selectedDateInput.value,
      atendimento: rawData.atendimento,
      hora: rawData.hora,
      palavra: rawData.palavra,
      oracao_pao: rawData.oracao_pao,
      oracao_calice: rawData.oracao_calice,
      diaconos: rawData.diaconos,
      ano_anterior: rawData.ano_anterior,
      roundsIrmas,
      roundsIrmaos
    };
    localStorage.setItem('santa_ceia_draft', JSON.stringify(draft));
  }

  function loadDraft() {
    const draftStr = localStorage.getItem('santa_ceia_draft');
    if (!draftStr) {
      addRound('irmas');
      addRound('irmaos');
      return;
    }

    const draft = JSON.parse(draftStr);
    selectedDateInput.value = draft.date || today;
    document.getElementById('inputAtendimento').value = draft.atendimento || '';
    document.getElementById('inputHora').value = draft.hora || '';
    document.getElementById('inputPalavra').value = draft.palavra || '';
    document.getElementById('inputOracaoPao').value = draft.oracao_pao || '';
    document.getElementById('inputOracaoCalice').value = draft.oracao_calice || '';
    document.getElementById('inputDiaconos').value = draft.diaconos || '';
    document.getElementById('inputAnoAnterior').value = draft.ano_anterior || 0;

    // Restaurar Rodadas
    irmasContainer.innerHTML = '';
    irmaosContainer.innerHTML = '';
    
    if (draft.roundsIrmas && draft.roundsIrmas.length > 0) {
      draft.roundsIrmas.forEach(r => {
        const card = createRoundCard(r.rodada, 'irmas');
        card.querySelector('input[type="number"]').value = r.val;
        card.querySelector('.total-field').value = r.val;
        irmasContainer.appendChild(card);
      });
      irmasRoundCount = draft.roundsIrmas.length;
    } else {
      addRound('irmas');
    }

    if (draft.roundsIrmaos && draft.roundsIrmaos.length > 0) {
      draft.roundsIrmaos.forEach(r => {
        const card = createRoundCard(r.rodada, 'irmaos');
        card.querySelector('input[type="number"]').value = r.val;
        card.querySelector('.total-field').value = r.val;
        irmaosContainer.appendChild(card);
      });
      irmaosRoundCount = draft.roundsIrmaos.length;
    } else {
      addRound('irmaos');
    }
  }

  // Monitorar todos os inputs para salvar rascunho
  form.addEventListener('input', saveDraft);

  // Impedir que o Enter envie o formulário acidentalmente
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      return false;
    }
  });

  loadDraft();

  selectedDateInput.addEventListener('change', () => {
    fetchEventMetadata();
    saveDraft();
  });

  btnAddIrmas.addEventListener('click', () => {
    addRound('irmas');
    saveDraft();
  });
  btnAddIrmaos.addEventListener('click', () => {
    addRound('irmaos');
    saveDraft();
  });

  // --- REPORT PREVIEW / PDF ---
  function openReport(autoPrint = false) {
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());
    
    const roundsIrmas = [];
    irmasContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      roundsIrmas.push({ rodada: parseInt(idx), val: rawData[`irmas_${idx}`] || '0' });
    });

    const roundsIrmaos = [];
    irmaosContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      roundsIrmaos.push({ rodada: parseInt(idx), val: rawData[`irmaos_${idx}`] || '0' });
    });

    const reportData = {
      date: selectedDateInput.value,
      comum: config.comum,
      atendimento: rawData.atendimento,
      hora: rawData.hora,
      palavra: rawData.palavra,
      oracao_pao: rawData.oracao_pao,
      oracao_calice: rawData.oracao_calice,
      diaconos: rawData.diaconos,
      ano_anterior: rawData.ano_anterior,
      roundsIrmas,
      roundsIrmaos
    };

    sessionStorage.setItem('santa_ceia_report_data', JSON.stringify(reportData));
    const url = autoPrint ? '/relatorio.html?autoPrint=true' : '/relatorio.html';
    window.open(url, '_blank');
  }

  btnPreviewReport.addEventListener('click', () => openReport(false));
  
  const btnDirectPDF = document.getElementById('btnDirectPDF');
  if (btnDirectPDF) {
    btnDirectPDF.addEventListener('click', () => openReport(true));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    const user = window.currentUser;
    if (!user) {
      Swal.fire({
        title: 'Erro',
        text: 'Você precisa estar logado para enviar.',
        icon: 'error',
        timer: 3000,
        timerProgressBar: true
      });
      return;
    }

    // Trava de segurança: Desabilitar botão para evitar duplo envio
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> ENVIANDO...';

    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());
    const eventDate = selectedDateInput.value;

    Swal.fire({
      title: 'Enviando tudo...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // 1. Unificar Rodadas (Irmãs e Irmãos na mesma linha por rodada)
    const roundsByNum = {};

    // Coletar das Irmãs
    irmasContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      const val = parseInt(rawData[`irmas_${idx}`]) || 0;
      roundsByNum[idx] = { irmas: val, irmaos: 0 };
    });

    // Coletar dos Irmãos e Mesclar com a mesma Rodada
    irmaosContainer.querySelectorAll('.sunday-card').forEach(card => {
      const idx = card.dataset.index;
      const val = parseInt(rawData[`irmaos_${idx}`]) || 0;
      if (roundsByNum[idx]) {
        roundsByNum[idx].irmaos = val;
      } else {
        roundsByNum[idx] = { irmas: 0, irmaos: val };
      }
    });

    // Transformar em array para o Supabase
    const rounds = Object.keys(roundsByNum).map(idx => ({
      data_evento: eventDate,
      municipio: config.municipio,
      comum: config.comum,
      rodada: parseInt(idx),
      irmas: roundsByNum[idx].irmas,
      irmaos: roundsByNum[idx].irmaos,
      total: roundsByNum[idx].irmas + roundsByNum[idx].irmaos,
      responsavel: window.auxiliarFullName,
      user_id: user.id
    })).filter(r => r.total > 0); // Só salva se houver alguém na rodada

    if (rounds.length === 0) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      Swal.fire({
        title: 'Aviso',
        text: 'Nenhuma rodada com integrantes informada.',
        icon: 'warning',
        timer: 3000,
        timerProgressBar: true
      });
      return;
    }

    // 2. Coletar Metadados (Detalhes do Atendimento)
    const eventMetadata = {
      data_evento: eventDate,
      municipio: config.municipio,
      comum: config.comum,
      atendimento: rawData.atendimento,
      hora: rawData.hora,
      palavra: rawData.palavra,
      oracao_pao: rawData.oracao_pao,
      oracao_calice: rawData.oracao_calice,
      diaconos: rawData.diaconos,
      ano_anterior: parseInt(rawData.ano_anterior) || 0,
      user_id: user.id
    };

    try {
      // 1. Salvar Rodadas
      const resRounds = await fetch('/api/santa-ceia-contagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rounds)
      });
      
      if (!resRounds.ok) {
        const err = await resRounds.json();
        throw new Error(err.error || 'Erro ao salvar as rodadas no banco.');
      }

      // 2. Salvar Metadados do Evento
      const resMeta = await fetch('/api/santa-ceia-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventMetadata)
      });

      if (!resMeta.ok) {
        const errData = await resMeta.json();
        throw new Error(errData.error || 'Erro ao salvar os detalhes do atendimento.');
      }

      Swal.fire({
        title: 'Sucesso!',
        text: 'Contagem e Atendimento sincronizados com o servidor.',
        icon: 'success',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
      });

      // Atualizar o resumo imediatamente
      fetchSummaryData();
      
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }, 2000);

    } catch (err) {
      console.error("Erro no envio:", err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      Swal.fire({
        title: 'Atenção',
        text: err.message || 'Ocorreu um erro ao conectar com o servidor.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#ef4444'
      });
    }
  });

  // --- FUNÇÃO DO MODAL DE DUPLICIDADE (ESTILO CCB - AJUSTADO PARA EVENTO) ---
  function showDuplicateModal(date, comum) {
    const now = new Date();
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
    const formattedTime = now.toLocaleTimeString('pt-BR');

    Swal.fire({
      html: `
        <div style="text-align: center; padding: 10px;">
          <div style="background: #eff6ff; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <h2 style="color: #475569; font-size: 24px; margin-bottom: 5px; font-weight: 700;">Santa Ceia já Registrada!</h2>
          <p style="color: #475569; font-size: 17px; margin-bottom: 20px;">
            O atendimento em <strong>${comum}</strong><br>
            referente ao dia <strong>${formattedDate}</strong><br>
            <span style="font-size: 15px; color: #64748b;">já consta em nosso banco de dados.</span>
          </p>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: left; border: 1px solid #e2e8f0; max-width: 320px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #475569; font-size: 14px;">Data do Envio:</span>
              <span style="color: #475569; font-size: 14px;">${formattedDate}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: 700; color: #475569; font-size: 14px;">Horário:</span>
              <span style="color: #475569; font-size: 14px;">${formattedTime}</span>
            </div>
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'ENTENDI',
      confirmButtonColor: '#2563eb',
      width: '450px',
      padding: '1.5rem',
      customClass: {
        popup: 'sac-duplicate-popup'
      },
      timer: 5000,
      timerProgressBar: true
    });
  }

  // --- LÓGICA DE RESUMO (DADOS REAIS DO BANCO) ---
  async function fetchSummaryData() {
    const date = selectedDateInput.value;
    if (!date) return;

    const listContainer = document.getElementById('summaryRoundsList');
    listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Atualizando dados...</p>';

    try {
      const res = await fetch(`/api/santa-ceia-contagem?date=${date}&municipio=${encodeURIComponent(config.municipio)}&comum=${encodeURIComponent(config.comum)}`);
      const data = await res.json();
      renderSummary(data);
    } catch (err) {
        console.error('Erro ao buscar resumo:', err);
      listContainer.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Falha ao carregar resumo do banco.</p>';
    }
  }

  function renderSummary(rounds) {
    const listContainer = document.getElementById('summaryRoundsList');
    const totalIrmasEl = document.getElementById('summaryTotalIrmas');
    const totalIrmaosEl = document.getElementById('summaryTotalIrmaos');
    const totalGeralEl = document.getElementById('summaryTotalGeral');

    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      if (totalIrmasEl) totalIrmasEl.textContent = '0';
      if (totalIrmaosEl) totalIrmaosEl.textContent = '0';
      if (totalGeralEl) totalGeralEl.textContent = '0';
      listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 30px;">Nenhuma rodada registrada para esta data no banco.</p>';
      return;
    }

    // --- DEDUPLICAÇÃO INTELIGENTE ---
    // Se houver lixo no banco (duplicados antigos), pegamos apenas o último registro de cada rodada
    const uniqueRoundsMap = new Map();
    rounds.forEach(r => {
      // Usamos a rodada como chave. Se repetir, o Map guarda apenas a última versão encontrada.
      uniqueRoundsMap.set(r.rodada, r);
    });
    
    // Converter de volta para array e ordenar
    const uniqueRounds = Array.from(uniqueRoundsMap.values()).sort((a, b) => a.rodada - b.rodada);

    let totalIrmas = 0;
    let totalIrmaos = 0;

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;"># Rodada</th>
            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #ec4899; text-align: center;">Irmãs</th>
            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; color: #3b82f6; text-align: center;">Irmãos</th>
            <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; font-weight: 800; text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${uniqueRounds.map(r => {
            totalIrmas += (r.irmas || 0);
            totalIrmaos += (r.irmaos || 0);
            return `
              <tr>
                <td><strong>Rodada #${r.rodada}</strong></td>
                <td style="text-align: center;">${r.irmas || 0}</td>
                <td style="text-align: center;">${r.irmaos || 0}</td>
                <td style="text-align: center;"><strong>${(r.irmas || 0) + (r.irmaos || 0)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    if (totalIrmasEl) totalIrmasEl.textContent = totalIrmas;
    if (totalIrmaosEl) totalIrmaosEl.textContent = totalIrmaos;
    if (totalGeralEl) totalGeralEl.textContent = totalIrmas + totalIrmaos;
    listContainer.innerHTML = tableHtml;
  }

  // --- LOGICA DE LIMPAR ---
  window.initNewCount = () => {
    Swal.fire({
      title: 'Iniciar Novo Atendimento?',
      text: 'Isso limpará todos os campos atuais. Certifique-se de que já salvou ou gerou o PDF.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, Limpar Tudo',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('santa_ceia_draft');
        window.location.reload();
      }
    });
  };
});
